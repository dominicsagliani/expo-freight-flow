"""Run with an exhibitor-only test session scoped to the isolated inbound verification event."""
import asyncio,json,uuid
from pathlib import Path
from playwright.async_api import async_playwright
from lovable_playwright_defaults import signed_in_context
from PIL import Image
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True); c=await signed_in_context(b); page=await c.new_page()
  await page.goto('http://localhost:8080/shipments?eventId=ab110000-0000-4000-8000-000000000004'); await page.get_by_role('button',name='Add expected shipment').wait_for()
  r=await page.evaluate('''async keys=>{const {supabase:db}=await import('/src/integrations/supabase/client.ts');const args={_event:'ab110000-0000-4000-8000-000000000004',_exhibitor:'ab110000-0000-4000-8000-000000000005',_carrier:'Exhibitor upload',_arrival:'2026-11-26',_count:1,_type:'crate',_note:'',_unexpected:false,_existing:[],_key:keys[0]}; const own=await db.rpc('register_inbound_shipment',args); const other=await db.rpc('register_inbound_shipment',{...args,_exhibitor:'ab110000-0000-4000-8000-000000000006',_key:keys[1]}); const receive=await db.rpc('receive_inbound_shipment',{_shipment:own.data,_pieces:[],_extra:1,_note:'',_path:'',_filename:'',_key:keys[2]});const cross=await db.rpc('register_inbound_shipment',{...args,_event:'30000000-0000-4000-8000-000000000001',_key:keys[3]}); const receipts=await db.from('inbound_receipts').select('id');const rows=await db.from('inbound_shipments').select('exhibitor_id').eq('event_id',args._event);return {own:own.data,ownError:own.error?.message,other:other.error?.message,receive:receive.error?.message,cross:cross.error?.message,receipts:receipts.data,rows:rows.data};}''',[str(uuid.uuid4()) for _ in range(4)])
  assert r['own'] and not r.get('ownError');assert r['other'] and r['receive'] and r['cross'];assert r['receipts']==[]; assert all(x['exhibitor_id']=='ab110000-0000-4000-8000-000000000005' for x in r['rows'])
  img=Image.new('RGB',(500,600),'white');f=Path('/tmp/browser/inbound/optional-bol.jpg');img.save(f)
  await page.get_by_role('button',name='Add expected shipment').click();d=page.get_by_role('dialog');await d.get_by_role('combobox',name='Shipment exhibitor').click();await page.get_by_role('option',name='Inbound verification exhibitor · Booth 101',exact=True).click();await d.get_by_label('Shipment carrier',exact=True).fill('Exhibitor document');await d.get_by_label('Expected arrival date',exact=True).fill('2026-11-26');await d.get_by_label('Shipment BOL',exact=True).set_input_files(str(f));await d.get_by_role('button',name='Save expected shipment',exact=True).click();await d.wait_for(state='hidden',timeout=20000)
  doc=await page.evaluate('''async()=>{const {supabase:db}=await import('/src/integrations/supabase/client.ts');const s=await db.from('inbound_shipments').select('storage_path').eq('carrier','Exhibitor document').single();const read=await db.storage.from('bol-documents').createSignedUrl(s.data.storage_path,300);return {path:s.data.storage_path,blocked:!!read.error};}''');assert doc['path'] and doc['blocked'];Path('/tmp/browser/inbound/document.json').write_text(json.dumps(doc))
  print('PASS: own exhibitor registration and optional BOL upload; other exhibitor/cross-company/receiving denied; arrival records and BOL download stay staff-private')
  await b.close()
asyncio.run(main())
