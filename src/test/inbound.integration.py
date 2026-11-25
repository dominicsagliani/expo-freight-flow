"""Signed-in shipment reconciliation regression test.
Requires an isolated event named Inbound verification 2026-11-25 with an assigned
exhibitor and active test access. Run after lovable auth-session --json --self.
No invoices are sent and no forklift reservations are made.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect
from lovable_playwright_defaults import signed_in_context

WORK = Path('/tmp/browser/inbound')
WORK.mkdir(parents=True, exist_ok=True)
EVENT = 'ab110000-0000-4000-8000-000000000004'
EXHIBITOR = 'ab110000-0000-4000-8000-000000000005'

async def rpc(page, name, args):
    result = await page.evaluate('''async ({name,args}) => {
      const {supabase:db}=await import('/src/integrations/supabase/client.ts');
      const r=await db.rpc(name,args); return {data:r.data,error:r.error?.message};
    }''', {'name': name, 'args': args})
    return result

async def read(page):
    return await page.evaluate('''async event => {
      const {supabase:db}=await import('/src/integrations/supabase/client.ts');
      const r=await db.from('inbound_shipments').select('*,freight:freight_items(id,freight_code,qr_token,arrival_status,inbound_extra),receipts:inbound_receipts(*)').eq('event_id',event);
      if(r.error) throw new Error(r.error.message); return r.data;
    }''', EVENT)

async def register_ui(page, carrier, unexpected=False):
    await page.get_by_role('button', name='Add expected shipment', exact=True).click()
    d = page.get_by_role('dialog')
    if unexpected:
        await d.get_by_role('checkbox', name='Unregistered shipment arriving now').check()
    await d.get_by_role('combobox', name='Shipment exhibitor').click()
    await page.get_by_role('option', name='Inbound verification exhibitor · Booth 101', exact=True).click()
    await d.get_by_label('Shipment carrier', exact=True).fill(carrier)
    await d.get_by_label('Expected arrival date', exact=True).fill('2026-11-25')
    await d.get_by_label('Shipment piece count', exact=True).fill('2' if unexpected else '3')
    await d.get_by_role('button', name='Receive shipment' if unexpected else 'Save expected shipment', exact=True).click()
    await expect(d).not_to_be_visible(timeout=20000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await signed_in_context(b)
        page = await c.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(f'http://localhost:8080/shipments?eventId={EVENT}')
        await page.get_by_role('button', name='Add expected shipment', exact=True).wait_for(timeout=30000)
        await expect(page.get_by_text('Dominic Sagliani', exact=True).first).to_be_visible()
        await register_ui(page, 'Partial carrier')
        shipment=(await read(page))[0]
        assert shipment['expected_pieces']==3 and len(shipment['freight'])==3
        identity={f['id']:(f['freight_code'],f['qr_token']) for f in shipment['freight']}
        summary=page.locator('summary').filter(has_text='Partial carrier')
        await summary.click()
        detail=summary.locator('..')
        await detail.get_by_role('button', name='Receive shipment', exact=True).click()
        d=page.get_by_role('dialog')
        codes=[f['freight_code'] for f in shipment['freight']]
        for code in codes[:2]:
            await d.get_by_role('checkbox',name=f'Receive {code}',exact=True).check()
            await d.get_by_label(f'Weight for {code}',exact=True).fill('100')
        await d.get_by_role('checkbox',name=f'Damage for {codes[0]}',exact=True).check()
        await d.get_by_label('Arrival notes',exact=True).fill('Corner dent recorded at receiving')
        await d.get_by_role('button',name='Confirm arrival',exact=True).click()
        await expect(d).not_to_be_visible(timeout=20000)
        await expect(summary).to_contain_text('2 received / 3 expected · 1 missing')
        await page.screenshot(path=str(WORK/'partial.png'))
        partial=(await read(page))[0]
        assert len(partial['receipts'])==1 and partial['receipts'][0]['received_count']==2
        assert sum(f['arrival_status']=='received' for f in partial['freight'])==2
        receipt=partial['receipts'][0]
        retry=await rpc(page,'receive_inbound_shipment',{'_shipment':shipment['id'],'_pieces':[],'_extra':2,'_note':'retry','_path':'','_filename':'','_key':receipt['intake_key']})
        assert not retry.get('error') and retry['data']==receipt['id']
        assert len((await read(page))[0]['freight'])==3
        await detail.get_by_role('button',name='Receive shipment',exact=True).click()
        d=page.get_by_role('dialog')
        await d.get_by_role('button',name='Select all remaining pieces',exact=True).click()
        await d.get_by_label('Additional pieces',exact=True).fill('1')
        await d.get_by_role('button',name='Confirm arrival',exact=True).click()
        await expect(d).not_to_be_visible(timeout=20000)
        await expect(summary).to_contain_text('4 received / 3 expected · 1 extra')
        full=(await read(page))[0]
        assert full['expected_pieces']==3 and len(full['freight'])==4
        assert sum(f['inbound_extra'] for f in full['freight'])==1
        for f in full['freight']:
            if f['id'] in identity: assert (f['freight_code'],f['qr_token'])==identity[f['id']]
        await register_ui(page,'Unexpected carrier',True)
        rows=await read(page)
        unexpected=next(s for s in rows if s['unexpected'])
        assert unexpected['expected_pieces']==0 and len(unexpected['freight'])==2
        assert all(f['arrival_status']=='received' for f in unexpected['freight'])
        await page.goto('http://localhost:8080/dashboard')
        overview=page.get_by_role('region',name='Inbound freight overview')
        await expect(overview).to_be_visible(timeout=20000)
        await overview.get_by_role('link').filter(has_text='Inbound verification exhibitor').first.click()
        await expect(page.locator('details[open]').filter(has_text='Inbound verification exhibitor')).to_be_visible()
        await page.screenshot(path=str(WORK/'details.png'))
        await page.set_viewport_size({'width':390,'height':844})
        await page.screenshot(path=str(WORK/'mobile.png'))
        assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors, errors
        (WORK/'result.json').write_text(json.dumps({'shipment':shipment['id'],'unexpected':unexpected['id'],'freight':list(identity),'event':EVENT}))
        print('PASS: registration without BOL, 2/3 partial, damage, retry, 4/3 extra, stable QR identity, unexpected arrival, dashboard drill-in, mobile layout')
        await b.close()

asyncio.run(main())