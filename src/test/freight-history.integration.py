"""Non-destructive preview check for crate chain-of-custody history.
Run after `lovable auth-session --json`: python3 src/test/freight-history.integration.py
Uses a real crate with a BOL and staging record; creates or changes no business data.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

WORK = Path('/tmp/browser/freight-history-integration')
WORK.mkdir(parents=True, exist_ok=True)

async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
        auth = json.load(f)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
        page = await context.new_page()
        page_errors = []
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        try:
            await page.goto('http://localhost:8080')
            await page.evaluate('([k,v]) => localStorage.setItem(k,v)', [auth['storage_key'], json.dumps(auth['session'])])
            await page.goto('http://localhost:8080/freight', wait_until='domcontentloaded')

            crate = await page.evaluate('''async () => {
              const {supabase:db}=await import('/src/integrations/supabase/client.ts');
              const staged=await db.from('freight_staging').select('freight_id').not('freight_id','is',null).limit(1);
              if(staged.error) throw Error(staged.error.message);
              const freightId=staged.data[0]?.freight_id;
              const freight=await db.from('freight_items').select('id,freight_code,event_id,bol_id').eq('id',freightId).single();
              if(freight.error) throw Error(freight.error.message);
              const history=await db.rpc('freight_chain_of_custody',{_freight:freightId});
              if(history.error) throw Error(history.error.message);
              const denied=await db.rpc('freight_chain_of_custody',{_freight:'00000000-0000-4000-8000-000000000099'});
              return {...freight.data,history:history.data,denied:!!denied.error};
            }''')
            assert crate['bol_id'], 'The check needs a crate linked to a BOL'
            assert crate['denied'], 'Unknown or unauthorized freight must be denied'
            assert crate['history']['freight']['bol']['document'], 'Staff must receive the authorized BOL document path'
            serialized = json.dumps(crate['history'])
            assert 'charge_amount' not in serialized and 'contact_email' not in serialized and 'contact_phone' not in serialized
            timestamps = [event['occurred_at'] for event in crate['history']['events']]
            assert timestamps == sorted(timestamps), 'Timeline must be chronological'
            assert any(event['kind'] == 'received' for event in crate['history']['events'])
            assert any(event['kind'] == 'staging' for event in crate['history']['events'])

            await page.get_by_role('button', name=f"View {crate['freight_code']} chain of custody", exact=True).first.click()
            dialog = page.get_by_role('dialog')
            await dialog.get_by_text('Crate timeline', exact=True).wait_for(timeout=30000)
            await dialog.get_by_text('Received at dock', exact=True).wait_for()
            assert await dialog.get_by_role('link', name='Open BOL', exact=True).count() == 1
            assert '$' not in await dialog.inner_text(), 'Crate history must not expose charges'
            await page.screenshot(path=str(WORK / 'staff-history.png'))
            await dialog.get_by_role('button', name='Close', exact=True).click()

            await page.goto('http://localhost:8080/event-status', wait_until='domcontentloaded')
            booth = page.get_by_role('button', name='View crates for booth', exact=False).first
            await booth.wait_for(timeout=20000)
            await booth.click()
            booth_dialog = page.get_by_role('dialog')
            await booth_dialog.get_by_role('button', name='chain of custody', exact=False).first.click()
            await page.get_by_role('dialog').last.get_by_text('Crate timeline', exact=True).wait_for(timeout=30000)

            assert not page_errors, page_errors
            print(json.dumps({'result': 'PASS', 'crate': crate['freight_code'], 'events': len(timestamps), 'unknown_freight_denied': True, 'private_bol_for_staff': True}))
        finally:
            await browser.close()

asyncio.run(main())
