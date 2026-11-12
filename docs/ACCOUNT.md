# Account menu and first-message suggestions

Update: migration 005 adds the public marketplace and replaces My Book Listings with My Listings. See MARKET_EVENTS.md for current role permissions and publishing.

Apply supabase/migrations/202611110004_account.sql after 003. It is transactional and re-runnable. It adds private bookmarks and book listings; existing data is preserved.

Profile opens the account menu: My Profile, My Posts, My Book Listings, Saved Items, My Groups, Settings, Help & Support, Log Out. My Posts and Saved Items paginate 20 rows at a time. Save post on Home bookmarks a post in Supabase. Deletion of a source post removes its bookmarks; original post RLS still controls access.

Book listings support create, edit, price/currency, condition, description, available/sold status and deletion. They are private inventory in this release; a public marketplace is not included. Settings persist on the current device: Enter-to-send and remembered email. Help includes FAQs and instructions for reporting a problem to the inviter, not a fake support form.

Empty direct conversations show Hello! I'm [sender profile name] after history has loaded. Clicking only fills an empty draft; sending remains explicit. Existing conversations and groups do not show it. It works after accepted friends open a direct conversation, for either participant.

Manual checks: account menu on mobile/desktop; edit profile; own posts; bookmark/unbookmark; create/edit/sell/delete book; open group; settings survive refresh; log out; accepted friend opens empty DM, selects suggestion, edits and sends it. No automatic message is sent on friend acceptance.
