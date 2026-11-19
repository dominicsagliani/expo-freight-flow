"""Destructive sandbox-reset integration check for an explicitly approved test workspace.

Usage: EXPOHAUL_ALLOW_SANDBOX_RESET=1 python3 src/test/sandbox-reset.integration.py
Requires a locally minted Lovable auth session. Never prints session credentials.
"""
import asyncio
import json
import os
from playwright.async_api import async_playwright

async def main():
    if os.environ.get("EXPOHAUL_ALLOW_SANDBOX_RESET") != "1":
        raise RuntimeError("Sandbox-reset integration test requires explicit opt-in")
    with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as f:
        session = json.load(f)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [session["storage_key"], json.dumps(session["session"])])
        await page.goto("http://localhost:8080/dispatch")
        await page.get_by_role("button", name="Sandbox", exact=True).wait_for()

        before = await page.evaluate("""async () => {
          const {supabase: db} = await import('/src/integrations/supabase/client.ts');
          const user = (await db.auth.getUser()).data.user;
          const roles = await db.from('user_roles').select('organization_id,role').eq('user_id',user.id);
          const org = roles.data.find(r => r.organization_id && ['company_admin','super_admin'].includes(r.role)).organization_id;
          const event = await db.from('events').select('id').eq('organization_id',org).neq('status','closed').order('start_date').limit(1).single();
          const billing = await db.from('tickets').select('id,charge_amount,status').eq('event_id',event.data.id).eq('status','completed').order('id');
          const freight = await db.from('freight_items').select('id,freight_code,qr_token,arrival_status,storage_location').eq('event_id',event.data.id).order('id');
          for (const r of [event,billing,freight]) if (r.error) throw new Error(r.error.message);
          return {eventId:event.data.id,billing:billing.data,freight:freight.data};
        }""")

        await page.get_by_role("button", name="Sandbox", exact=True).click()
        await page.get_by_role("button", name="Clear open jobs", exact=True).click()
        await page.get_by_role("dialog").wait_for(state="detached")
        quick = await page.evaluate("""async (eventId) => {
          const {supabase: db} = await import('/src/integrations/supabase/client.ts');
          const jobs = await db.from('tickets').select('id').eq('event_id',eventId).in('status',['requested','assigned','in_progress']);
          const queues = await db.from('queue_drivers').select('user_id').eq('event_id',eventId);
          const sessions = await db.from('work_sessions').select('id,ticket:tickets!inner(event_id)').eq('ticket.event_id',eventId).neq('status','completed');
          const freight = await db.from('freight_items').select('id,freight_code,qr_token,arrival_status,storage_location').eq('event_id',eventId).order('id');
          const denied = await db.rpc('sandbox_reset_event',{_event:'00000000-0000-4000-8000-000000000099',_deep:false});
          for (const r of [jobs,queues,sessions,freight]) if (r.error) throw new Error(r.error.message);
          return {jobs:jobs.data,queues:queues.data,sessions:sessions.data,freight:freight.data,denied:!!denied.error};
        }""", before["eventId"])
        assert quick["jobs"] == [], "Quick Clear must cancel every open job at the selected show"
        assert quick["queues"] == [], "Quick Clear must release forklift reservations"
        assert quick["sessions"] == [], "Quick Clear must stop open timers"
        assert quick["freight"] == before["freight"], "Quick Clear must not change crate states or identities"
        assert quick["denied"], "Sandbox reset must reject an unknown or outside-tenant event"

        await page.get_by_role("button", name="Sandbox", exact=True).click()
        await page.get_by_text("Deep Reset", exact=True).click()
        await page.get_by_label("Type RESET to confirm").fill("RESET")
        await page.get_by_role("button", name="Deep reset show", exact=True).click()
        await page.get_by_role("dialog").wait_for(state="detached")
        deep = await page.evaluate("""async (eventId) => {
          const {supabase: db} = await import('/src/integrations/supabase/client.ts');
          const billing = await db.from('tickets').select('id,charge_amount,status').eq('event_id',eventId).eq('status','completed').order('id');
          const freight = await db.from('freight_items').select('id,freight_code,qr_token,arrival_status,storage_location').eq('event_id',eventId).order('id');
          for (const r of [billing,freight]) if (r.error) throw new Error(r.error.message);
          return {billing:billing.data,freight:freight.data};
        }""", before["eventId"])
        assert deep["billing"] == before["billing"], "Both reset modes must preserve completed billing exactly"
        assert [(f["id"], f["freight_code"], f["qr_token"]) for f in deep["freight"]] == [(f["id"], f["freight_code"], f["qr_token"]) for f in before["freight"]], "Deep Reset must reuse crate identities and labels"
        for crate in deep["freight"]:
            expected = "in_storage" if crate["storage_location"] and crate["storage_location"].strip() else "received"
            assert crate["arrival_status"] == expected, f"Crate must return to {expected}"

        await page.screenshot(path="/tmp/browser/sandbox-reset/verified.png")
        print("PASS: Quick Clear cancels open work and preserves crates; Deep Reset reuses labels; completed billing and tenant boundaries hold")
        await browser.close()

asyncio.run(main())
