# Marketplace, events and account roles

## Apply the update

Run only `supabase/migrations/202611110005_market_events.sql` in the existing Warmly Supabase project after migrations 002, 003 and 004. The migration is transactional and can be rerun. It preserves existing data. Existing book listings stay private (`published=false`) until their owner explicitly publishes them.

Existing members choose an account type on their next sign-in. New members select Student, University or Visitor before authentication and confirm it during profile setup. The choice is stored in `account_roles`, not trusted user-editable Auth metadata. A visitor cannot change their role by modifying browser state or calling the selection RPC again. Role changes are administrator operations.

| Capability | Student | Approved university | Visitor / pending university |
| --- | --- | --- | --- |
| Chat, friends, groups, feed, stories | Yes | Yes | Yes |
| Browse published items / message seller | Yes | Yes | Yes |
| Create and edit item listings | Yes | Yes | No |
| Browse and register for events | Yes | Yes | Yes |
| Create, edit and cancel own events | No | Yes | No |

University applicants enter their institution name. Until approved, they receive visitor permissions. Choosing Student is self-declared, as specified for this milestone; university verification is manual.

## Approve a university

In Supabase SQL Editor, inspect pending applications:

```sql
select r.user_id, p.name, p.username, u.email, r.university_name, r.created_at
from public.account_roles r
join public.profiles p on p.id = r.user_id
join auth.users u on u.id = r.user_id
where r.requested_role = 'university' and not r.approved
order by r.created_at;
```

Verify the institution and applicant yourself. Then in Table Editor > account_roles, find that exact user_id and change `approved` to `true`. Leave `requested_role` as `university`. Alternatively, replace the UUID below with the selected applicant's ID and run:

```sql
update public.account_roles
set approved = true
where user_id = 'REPLACE_WITH_APPLICANT_UUID'::uuid
  and requested_role = 'university'
returning user_id, requested_role, university_name, approved;
```

The account owner can reopen Events to refresh permissions. Set `approved=false` to revoke university publishing access immediately in database policies. Existing events remain visible and registrable; the administrator should cancel any events that must no longer run. There is no automatic trust based on email domains or client metadata.

## Marketplace

Market has categories (Books, Notes, Electronics, Other), title search, paginated results, photo/details, price/currency and Message seller. Sellers manage their items through My listings or Profile > My Listings. They can keep a private draft, publish, edit, mark sold or delete. Guests here means signed-in Visitor accounts, not unauthenticated browsing.

Message seller opens a private direct conversation even without friendship. It does not send a message automatically and does not create a friend relationship or expose either person's friends-only feed. The server resolves the seller from the available published listing, ignores arbitrary recipient IDs, and reuses an existing pair conversation. Once created, that conversation remains usable if the listing is sold or removed. No payments, delivery or checkout is included.

## Events

Upcoming lists scheduled future events; My Events includes a member's registrations and cancelled events. Approved universities also see Hosting, create/edit/cancel their own events, and can view the first 200 attendees per event. Attendee lists are private to the organizer and each attendee can read only their own registration otherwise.

Date/time input uses the organizer's device timezone, stores UTC and displays each viewer's local time. Capacity is optional. Registration locks the event row, checks capacity, future date and cancellation, and is idempotent. Members can cancel their own registration. Event cancellation stays visible in My Events; no email or push notification is sent. Decreasing capacity below existing registrations is rejected.

Photos use the same small JPEG-in-row approach as the social MVP (800px max edge, 220,000 characters maximum). A private media-storage migration remains future work for larger scale.

## Test before inviting people

1. Student: publish a listing with a photo and price, edit it, save a private draft, mark an item sold.
2. Visitor: browse/search; no Sell button; Message seller opens a chat; posts/stories/groups still work.
3. University: request access; no Create event until manually approved; reopen Events after approval.
4. Approved university: create an event with capacity 1, edit it, inspect attendees and cancel it.
5. Two other accounts: first registration succeeds, second receives full-capacity feedback; cancelling the first frees the place. Cancelled/past events reject registration.
6. Existing account: choose its role once without losing profile, conversations or posts.

Automated PostgreSQL tests cover role escalation, direct writes, approval/revocation, private drafts, seller-chat isolation/reuse, event owner restrictions, registration capacity/idempotency/cancellation, past events and anonymous denial. UI integration is compiled in the separate QA build with synthetic data; it never writes to Supabase.
