"""Explicit signed-in integration check. Run only in a workspace cleared for reset.

Usage: EXPOHAUL_ALLOW_DRIVER_RESET=1 python3 src/test/admin-operations.integration.py
Requires a locally minted Lovable auth session. Never prints session credentials.
"""
import asyncio
import json
import os
from playwright.async_api import async_playwright


async def main():
    if os.environ.get("EXPOHAUL_ALLOW_DRIVER_RESET") != "1":
        raise RuntimeError("Driver-reset integration test requires explicit opt-in")
    with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as f:
        session = json.load(f)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [session["storage_key"], json.dumps(session["session"])])
        await page.goto("http://localhost:8080/operators")
        await page.get_by_role("button", name="Reset all drivers", exact=True).wait_for()
        result = await page.evaluate("""async () => {
          const {supabase: db} = await import('/src/integrations/supabase/client.ts');
          const user = (await db.auth.getUser()).data.user;
          const roles = await db.from('user_roles').select('organization_id,role').eq('user_id',user.id);
          const org = roles.data.find(r => r.organization_id && ['company_admin','super_admin'].includes(r.role)).organization_id;
          const before = await db.from('tickets').select('id,charge_amount').eq('organization_id',org).eq('status','completed').order('id');
          const wrongOrg = await db.rpc('reset_org_drivers',{_org:'00000000-0000-4000-8000-000000000099'});
          const reset = await db.rpc('reset_org_drivers',{_org:org});
          if (reset.error) throw new Error(reset.error.message);
          const after = await db.from('tickets').select('id,charge_amount').eq('organization_id',org).eq('status','completed').order('id');
          const drivers = await db.from('operators').select('status').eq('organization_id',org);
          const jobs = await db.from('tickets').select('id').eq('organization_id',org).in('status',['requested','assigned','in_progress']);
          const queues = await db.from('queue_drivers').select('user_id').eq('organization_id',org);
          const sessions = await db.from('work_sessions').select('id').eq('organization_id',org).neq('status','completed');
          for (const r of [before,after,drivers,jobs,queues,sessions]) if (r.error) throw new Error(r.error.message);
          return {before:before.data,after:after.data,drivers:drivers.data,jobs:jobs.data,queues:queues.data,sessions:sessions.data,wrongOrgDenied:!!wrongOrg.error};
        }""")
        assert result["before"] == result["after"], "Completed customer charges must remain unchanged"
        assert result["drivers"] and all(d["status"] == "available" for d in result["drivers"])
        assert result["jobs"] == [], "Reset cancels all unfinished tickets"
        assert result["queues"] == [], "Reset releases reservations"
        assert result["sessions"] == [], "Reset stops all open timers"
        assert result["wrongOrgDenied"], "Admin reset must remain tenant-scoped"
        await page.reload()
        await page.get_by_role("button", name="Reset all drivers", exact=True).wait_for()
        await page.screenshot(path="/tmp/browser/admin-reset/verified.png")
        print("PASS: drivers available, unfinished jobs cancelled, timers stopped, reservations released, completed billing preserved, tenant boundary enforced")
        await browser.close()


asyncio.run(main())