"""Authenticated worker CRUD and exclusive reservation checks; uses a minted owner session.
Run: python3 src/test/workers.integration.py
Creates temporary workers, takes an idle lift online/offline, then retires the workers.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
        auth = json.load(f)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width":1280,"height":1800})
        page = await context.new_page()
        await page.goto('http://localhost:8080')
        await page.evaluate('([k,v]) => localStorage.setItem(k,v)', [auth['storage_key'],json.dumps(auth['session'])])
        await page.goto('http://localhost:8080/operators')
        await page.get_by_role('button',name='Add worker',exact=True).wait_for()
        if await page.get_by_role('button',name='Delete Verified WorkerTest').count():
            await page.get_by_role('button',name='Delete Verified WorkerTest').click()
            await page.get_by_role('button',name='Delete worker',exact=True).click()
            await page.get_by_role('button',name='Edit Verified WorkerTest').wait_for(state='detached')
        await page.get_by_role('button',name='Add worker',exact=True).click()
        await page.get_by_label('First name',exact=True).fill('Preview')
        await page.get_by_label('Last name',exact=True).fill('WorkerTest')
        await page.get_by_role('dialog').get_by_role('button',name='Add worker',exact=True).click()
        await page.get_by_role('button',name='Edit Preview WorkerTest').click()
        await page.get_by_label('First name',exact=True).fill('Verified')
        await page.get_by_role('button',name='Save worker',exact=True).click()
        await page.get_by_role('button',name='Edit Verified WorkerTest').wait_for()
        await page.screenshot(path='/tmp/browser/workers/list.png')
        result = await page.evaluate('''async () => {
          const {supabase: db}=await import('/src/integrations/supabase/client.ts');
          const w=(await db.from('operators').select('*').eq('full_name','Verified WorkerTest').is('retired_at',null).single()).data;
          if(!w) throw Error('Worker missing');
          const invalid=await db.rpc('manage_worker',{_org:w.organization_id,_first:'',_last:'Test'});
          const wrong=await db.rpc('manage_worker',{_org:'00000000-0000-4000-8000-000000000099',_first:'Other',_last:'Tenant'});
          return {worker:w.id,invalidDenied:!!invalid.error,otherOrgDenied:!!wrong.error};
        }''')
        assert result['invalidDenied'], 'Both first and last names are required'
        assert result['otherOrgDenied'], 'Worker management must remain admin- and tenant-scoped'
        page = await context.new_page()
        await page.goto('http://localhost:8080/forklift')
        await page.screenshot(path='/tmp/browser/workers/selection.png')
        await page.wait_for_timeout(10000)
        if await page.get_by_role('button',name='Offline',exact=True).count():
            await page.get_by_role('button',name='Offline',exact=True).click()
        await page.get_by_label('Driver',exact=True).select_option(label='Verified WorkerTest')
        lift=page.get_by_role('button').filter(has_text='FL-01').first
        await lift.click()
        await page.get_by_role('button',name='Offline',exact=True).wait_for()
        assert await page.get_by_text('Verified WorkerTest',exact=True).count()==1
        reserve=await page.evaluate('''async () => {
          const {supabase:db}=await import('/src/integrations/supabase/client.ts');
          const uid=(await db.auth.getUser()).data.user.id;
          const q=(await db.from('queue_drivers').select('*').eq('user_id',uid).single()).data;
          if(!q) throw Error('Missing reservation');
          const all=await db.from('queue_drivers').select('user_id').eq('equipment_id',q.equipment_id);
          const w=(await db.from('operators').select('first_name,last_name').eq('id',q.operator_id).single()).data;
          const removal=await db.rpc('manage_worker',{_org:q.organization_id,_worker:q.operator_id,_remove:true});
          return {count:all.data.length,worker:w,deleteDenied:!!removal.error};
        }''')
        assert reserve['count']==1, 'Only one worker may reserve a machine'
        assert reserve['worker']=={'first_name':'Verified','last_name':'WorkerTest'}
        assert reserve['deleteDenied'], 'Online workers cannot be removed'
        await page.screenshot(path='/tmp/browser/workers/dashboard.png')
        await page.set_viewport_size({'width':390,'height':844})
        await page.screenshot(path='/tmp/browser/workers/mobile.png')
        await page.get_by_role('button',name='Offline',exact=True).click()
        await page.get_by_label('Driver',exact=True).wait_for()
        await page.set_viewport_size({'width':1280,'height':1800})
        await page.goto('http://localhost:8080/operators')
        await page.get_by_role('button',name='Delete Verified WorkerTest').click()
        await page.get_by_role('button',name='Delete worker',exact=True).click()
        await page.get_by_role('button',name='Edit Verified WorkerTest').wait_for(state='detached')
        page = await context.new_page()
        await page.goto('http://localhost:8080/forklift')
        await page.screenshot(path='/tmp/browser/workers/selection.png')
        await page.get_by_label('Driver',exact=True).wait_for()
        assert await page.get_by_label('Driver',exact=True).locator('option').filter(has_text='Verified WorkerTest').count()==0
        print('PASS: worker create/edit/remove, required names, tenant denial, named dashboard, one reservation per machine, online deletion blocked, removed worker absent')
        await browser.close()

asyncio.run(main())
