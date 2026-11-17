"""Real preview check for BOL upload, multi-crate receiving, labels and document retrieval.
Run after `lovable auth-session --json`: python3 src/test/bol-receiving.integration.py
The test names its shipment BOL-INTEGRATION-TEST so its records can be removed afterward.
"""
import asyncio
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright

WORK = Path('/tmp/browser/bol-receiving')
WORK.mkdir(parents=True, exist_ok=True)
PDF = WORK / 'BOL integration test.pdf'
image = Image.new('RGB', (850, 1100), 'white')
draw = ImageDraw.Draw(image)
draw.text((60, 60), 'EXPOHAUL BOL INTEGRATION TEST', fill='black')
draw.text((60, 120), 'Carrier: YRC Integration Test', fill='black')
draw.text((60, 160), 'PRO: BOL-INTEGRATION-TEST', fill='black')
draw.text((60, 200), 'Pieces: 4 crates', fill='black')
image.save(PDF, 'PDF', resolution=100.0)

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
            await page.get_by_role('button', name='BOL check-in', exact=True).wait_for(timeout=20000)
            await page.screenshot(path=str(WORK / '1-freight-before.png'))
            await page.get_by_role('button', name='BOL check-in', exact=True).click()
            dialog = page.get_by_role('dialog')
            await dialog.get_by_text('Bill of Lading', exact=True).wait_for()
            await dialog.locator('input[accept*="application/pdf"]').set_input_files(str(PDF))
            await dialog.get_by_text(PDF.name, exact=True).wait_for()
            await dialog.locator('object[aria-label="Bill of Lading PDF preview"]').wait_for()

            combos = dialog.get_by_role('combobox')
            await combos.nth(1).click()
            await page.get_by_role('option').first.click()
            await dialog.get_by_placeholder('e.g. YRC Freight').fill('YRC Integration Test')
            await dialog.get_by_placeholder('Optional').nth(0).fill('BOL-INTEGRATION-TEST')
            await dialog.get_by_placeholder('Optional').nth(1).fill('Integration Shipper')
            await dialog.get_by_placeholder('e.g. Trade show display materials').fill('BOL integration test freight')
            await dialog.get_by_placeholder('If available').nth(1).fill('400')
            await dialog.get_by_placeholder('Optional — fragile, top load only, delivery notes…').fill('Keep upright')
            await dialog.locator('input[max="50"]').fill('4')
            await dialog.get_by_role('button', name='Distribute total weight evenly', exact=True).click()
            for index in range(1, 5):
                assert await dialog.get_by_label(f'Crate {index} weight', exact=True).input_value() == '100.00'
            await page.screenshot(path=str(WORK / '2-bol-four-crates.png'))

            await page.evaluate('window.__printCalls = 0; window.print = () => { window.__printCalls += 1; }')
            await dialog.get_by_role('button', name='Check in & print 4 labels', exact=True).click()
            await page.wait_for_url('**/bol-labels/*', timeout=30000)
            await page.locator('.print-label').nth(3).wait_for(timeout=20000)
            await page.locator('.print-label img[alt="Freight QR code"]').nth(3).wait_for(timeout=20000)
            await page.wait_for_function('window.__printCalls === 1', timeout=10000)
            assert await page.locator('.print-label').count() == 4
            assert await page.locator('.print-label img[alt="Freight QR code"]').count() == 4
            await page.screenshot(path=str(WORK / '3-four-labels.png'))
            bol_id = page.url.split('/bol-labels/')[1].split('?')[0]

            saved = await page.evaluate('''async (bolId) => {
              const {supabase:db}=await import('/src/integrations/supabase/client.ts');
              const bol=await db.from('bills_of_lading').select('*').eq('id',bolId).single();
              if(bol.error) throw Error(bol.error.message);
              const crates=await db.from('freight_items').select('id,bol_id,bol_crate_number,freight_code,qr_token,arrival_status,weight_lbs,pieces').eq('bol_id',bolId).order('bol_crate_number');
              if(crates.error) throw Error(crates.error.message);
              return {bol:bol.data,crates:crates.data};
            }''', bol_id)
            assert saved['bol']['original_filename'] == PDF.name, saved['bol']
            assert saved['bol']['carrier_name'] == 'YRC Integration Test'
            assert saved['bol']['pro_number'] == 'BOL-INTEGRATION-TEST'
            assert saved['bol']['special_instructions'] == 'Keep upright'
            assert len(saved['crates']) == 4, saved
            assert len({row['freight_code'] for row in saved['crates']}) == 4
            assert len({row['qr_token'] for row in saved['crates']}) == 4
            assert all(row['arrival_status'] == 'received' and row['pieces'] == 1 for row in saved['crates'])
            assert all(float(row['weight_lbs']) == 100 for row in saved['crates'])

            await page.goto('http://localhost:8080/freight', wait_until='domcontentloaded')
            await page.get_by_text(PDF.name, exact=True).wait_for(timeout=20000)
            open_bol = page.get_by_role('link', name='Open BOL', exact=True)
            href = await open_bol.get_attribute('href')
            assert href
            document_response = await page.request.get(href)
            assert document_response.status == 200, document_response.status
            assert 'pdf' in (document_response.headers.get('content-type') or '').lower()
            await page.locator('details summary').click()
            await page.get_by_text('Crate 4', exact=True).wait_for()
            assert await page.get_by_role('link', name='Reprint', exact=True).count() == 4
            await page.screenshot(path=str(WORK / '4-saved-bol-dashboard.png'))

            await page.get_by_role('link', name='Reprint', exact=True).first.click()
            await page.wait_for_url('**/labels/*')
            await page.locator('.print-label').wait_for()
            assert await page.locator('.print-label').count() == 1
            await page.goto('http://localhost:8080/freight', wait_until='domcontentloaded')
            await page.get_by_role('link', name='Reprint all', exact=True).wait_for()
            await page.evaluate('window.__printCalls = 0; window.print = () => { window.__printCalls += 1; }')
            await page.get_by_role('link', name='Reprint all', exact=True).click()
            await page.wait_for_url('**/bol-labels/*')
            await page.locator('.print-label').nth(3).wait_for()
            # Reset the instrumented counter so this checks the manual reprint button itself.
            await page.evaluate('window.__printCalls = 0')
            await page.get_by_role('button', name='Print 4 labels', exact=True).click()
            assert await page.evaluate('window.__printCalls') == 1

            retry = await page.evaluate('''async (bol) => {
              const {supabase:db}=await import('/src/integrations/supabase/client.ts');
              const {data,error}=await db.rpc('receive_bill_of_lading', {
                _event:bol.event_id, _exhibitor:bol.exhibitor_id, _storage_path:bol.storage_path,
                _filename:bol.original_filename, _mime:bol.mime_type, _file_size:bol.file_size_bytes,
                _carrier:bol.carrier_name, _pro:bol.pro_number, _shipper:bol.shipper_name,
                _consignee:bol.consignee_name, _booth:bol.booth_number, _declared_pieces:4,
                _description:bol.description, _total_weight:bol.total_weight_lbs,
                _special:bol.special_instructions, _crates:[], _intake_key:bol.intake_key
              });
              if(error) throw Error(error.message);
              const count=await db.from('freight_items').select('id',{count:'exact',head:true}).eq('bol_id',bol.id);
              if(count.error) throw Error(count.error.message);
              return {result:data,count:count.count};
            }''', saved['bol'])
            assert retry['result']['bol_id'] == bol_id, retry
            assert retry['count'] == 4, retry

            await page.set_viewport_size({'width': 390, 'height': 844})
            await page.goto('http://localhost:8080/freight', wait_until='domcontentloaded')
            await page.get_by_role('button', name='BOL check-in', exact=True).click()
            await page.get_by_role('dialog').get_by_text('Bill of Lading', exact=True).wait_for()
            await page.screenshot(path=str(WORK / '5-mobile-bol-form.png'))
            mobile_widths = await page.evaluate('({viewport:window.innerWidth,document:document.documentElement.scrollWidth})')
            assert mobile_widths['document'] <= mobile_widths['viewport'] + 1, mobile_widths
            assert not page_errors, page_errors
            result = {'result': 'PASS', 'bol_id': bol_id, 'crate_count': retry['count'], 'automatic_print_calls': 1, 'document_http_status': document_response.status, 'retry_created_duplicates': False}
            (WORK / 'result.json').write_text(json.dumps(result))
            print(json.dumps(result))
        finally:
            await browser.close()

asyncio.run(main())
