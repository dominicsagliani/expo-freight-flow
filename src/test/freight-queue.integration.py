"""Real preview check for scan-to-queue, forced assignment, and the delivery lifecycle.
Run after `lovable auth-session --json`: python3 src/test/freight-queue.integration.py
Uses the current event's first freight item and FL-01; clean up its test ticket afterward.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path('/tmp/browser/freight-queue')
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
        auth = json.load(f)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
        page = await context.new_page()
        page_errors = []
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        await page.goto('http://localhost:8080')
        await page.evaluate('([k,v]) => localStorage.setItem(k,v)', [auth['storage_key'], json.dumps(auth['session'])])
        await page.goto('http://localhost:8080/forklift', wait_until='domcontentloaded')

        await page.get_by_role('button', name='Offline', exact=True).or_(page.get_by_role('option', name='Dominic Sagliani', exact=True)).first.wait_for(timeout=20000)
        if not await page.get_by_role('button', name='Offline', exact=True).count():
            await page.get_by_role('option', name='Dominic Sagliani', exact=True).wait_for()
            await page.get_by_label('Driver', exact=True).select_option(label='Dominic Sagliani')
            await page.get_by_role('button').filter(has_text='FL-01').first.click()
        await page.get_by_role('button', name='Offline', exact=True).wait_for()

        freight = await page.evaluate('''async () => {
          const {supabase:db}=await import('/src/integrations/supabase/client.ts');
          const {data,error}=await db.from('freight_items').select('id,qr_token,freight_code').order('created_at').limit(1).single();
          if(error) throw Error(error.message);
          return data;
        }''')

        async def scan_to_queue():
            await page.get_by_role('button', name='Scan freight to queue', exact=True).click()
            await page.get_by_label('Freight label code', exact=True).fill(freight['qr_token'])
            await page.get_by_role('button', name='Queue', exact=True).click()

        await scan_to_queue()
        await page.get_by_text('Sent to Dominic Sagliani · FL-01', exact=True).wait_for()
        await page.screenshot(path=str(SCREENSHOTS / '1-forced-assignment.png'))
        assigned = await page.evaluate('''async (freightId) => {
          const {supabase:db}=await import('/src/integrations/supabase/client.ts');
          const {data,error}=await db.from('ticket_freight').select('ticket_id,picked_up_at,delivered_at,ticket:tickets(ticket_number,status,assigned_operator_id,assigned_equipment_id,operator:operators!tickets_assigned_operator_id_fkey(full_name),equipment:equipment!tickets_assigned_equipment_id_fkey(unit_number))').eq('freight_id',freightId).single();
          if(error) throw Error(error.message);
          const sessions=await db.from('work_sessions').select('id').eq('ticket_id',data.ticket_id);
          if(sessions.error) throw Error(sessions.error.message);
          return {...data,sessions:sessions.data};
        }''', freight['id'])
        ticket = assigned['ticket']
        assert ticket['status'] == 'assigned', ticket
        assert ticket['operator']['full_name'] == 'Dominic Sagliani', ticket
        assert ticket['equipment']['unit_number'] == 'FL-01', ticket
        assert assigned['picked_up_at'] is None and assigned['delivered_at'] is None, assigned
        assert assigned['sessions'] == [], 'Queue scan must not start billable time'

        await page.get_by_role('button', name='Done', exact=True).click()
        await scan_to_queue()
        await page.get_by_text(f"Already on an open delivery job · {ticket['ticket_number']}", exact=True).wait_for()
        await page.get_by_role('button', name='Done', exact=True).click()
        await page.get_by_text(ticket['ticket_number'], exact=True).first.wait_for()
        await page.screenshot(path=str(SCREENSHOTS / '2-personal-queue.png'))

        await page.get_by_role('button', name='Scan freight', exact=True).click()
        await page.get_by_label('Scanner input', exact=True).fill(freight['qr_token'])
        await page.get_by_role('button', name='Go', exact=True).click()
        await page.get_by_text('SCANNED IN', exact=True).wait_for()
        picked = await page.evaluate('''async (ticketId) => {
          const {supabase:db}=await import('/src/integrations/supabase/client.ts');
          const tf=await db.from('ticket_freight').select('picked_up_at').eq('ticket_id',ticketId).single();
          const sessions=await db.from('work_sessions').select('status').eq('ticket_id',ticketId);
          return {picked:tf.data,sessions:sessions.data};
        }''', assigned['ticket_id'])
        assert picked['picked']['picked_up_at'] is not None, picked
        assert [s['status'] for s in picked['sessions']] == ['active'], picked

        await page.get_by_role('button', name='Scan next', exact=True).click()
        await page.get_by_role('button', name='SCAN OUT', exact=True).click()
        await page.get_by_label('Scanner input', exact=True).fill(freight['qr_token'])
        await page.get_by_role('button', name='Go', exact=True).click()
        await page.get_by_role('button', name='Confirm scan-out', exact=True).click()
        await page.get_by_text('SCANNED OUT', exact=True).wait_for()
        await page.get_by_text('Job completed · Charge added to customer account', exact=True).wait_for()
        await page.screenshot(path=str(SCREENSHOTS / '3-delivered.png'))
        completed = await page.evaluate('''async (ticketId) => {
          const {supabase:db}=await import('/src/integrations/supabase/client.ts');
          const t=await db.from('tickets').select('status,charge_amount').eq('id',ticketId).single();
          const tf=await db.from('ticket_freight').select('delivered_at').eq('ticket_id',ticketId).single();
          const sessions=await db.from('work_sessions').select('status,billable_amount').eq('ticket_id',ticketId);
          return {ticket:t.data,freight:tf.data,sessions:sessions.data};
        }''', assigned['ticket_id'])
        assert completed['ticket']['status'] == 'completed', completed
        assert completed['ticket']['charge_amount'] > 0, completed
        assert completed['freight']['delivered_at'] is not None, completed
        assert all(s['status'] == 'completed' for s in completed['sessions']), completed

        await page.get_by_role('button', name='Next job', exact=True).click()
        await page.get_by_role('button', name='Offline', exact=True).click()
        await page.get_by_label('Driver', exact=True).wait_for()
        assert not page_errors, page_errors
        print(json.dumps({'result': 'PASS', 'ticket_id': assigned['ticket_id'], 'ticket_number': ticket['ticket_number'], 'freight_id': freight['id'], 'charge': completed['ticket']['charge_amount']}))
        await browser.close()

asyncio.run(main())
