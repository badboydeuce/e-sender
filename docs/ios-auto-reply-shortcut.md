# Stage 4.2 — iPhone Auto Reply Shortcut

This guide connects an enrolled iPhone to the Stage 4.1 auto-reply API. The iPhone receives the SMS and sends any returned reply through its own SIM/eSIM. The Railway API never sends SMS.

## Important iOS behavior

- Create a Personal Automation using the **Message** trigger.
- Choose the sender/message filters supported by the installed iOS version. If the intent is to process every sender, leave the sender filter broad if iOS offers that option.
- Choose **Run Immediately** when the iOS version offers it. If iOS asks for confirmation or blocks an unattended send, that is an operating-system restriction, not something the server can override.
- Message automations are not a guaranteed always-on service. Test with a phone you control before relying on it.
- The Send Message action may show a confirmation or require user interaction depending on iOS settings/version. Do not assume silent sending until verified on the target iPhone.
- Do not use this workflow for unsolicited messaging. Only configure replies for people who have contacted the business or otherwise have an appropriate basis for the response.

## One-time device setup

1. Enroll the iPhone using the existing device enrollment flow.
2. Save the returned device token in the Shortcut as a private Text action. Do not put the token in a shared message, screenshot, public document, or Git commit.
3. Copy the Railway API base URL, e.g. `https://YOUR-API-DOMAIN` (no trailing slash).
4. In the admin dashboard, open **Auto Reply**, enable the global switch, enable the target device, and create a global or device-specific rule.
5. Use an iPhone test number that you control. Begin with a simple fallback reply and a long cooldown.

## Build the personal automation

In Shortcuts on the iPhone:

1. Open **Automation** → **New Automation** → **Message**.
2. Configure the sender/message filters according to the test you want. For broad inbound handling, select the broadest sender filter the OS permits.
3. Choose the option to run immediately if available.
4. Add actions below in the stated order. Names may vary slightly across iOS releases.

### Shortcut action sequence

**A. Read the incoming message**

1. Use the automation's incoming **Message** input (Shortcut Input) as the source.
2. Get the message sender/contact/phone number from that message object. Convert it to E.164 format (leading + and country code). If the sender cannot be normalized, stop without replying.
3. Get the message text from the incoming Message object.
4. Create a unique message ID for this trigger using the Shortcuts **Generate UUID** action. Store it as `message_id`. This is a per-trigger idempotency key; do not regenerate it when retrying the same API request.

**B. Ask the API which reply to use**

5. Add a **Get Contents of URL** action.
6. URL: `https://YOUR-API-DOMAIN/api/device/incoming-message`.
7. Method: **POST**.
8. Headers:
   - `Content-Type` = `application/json`
   - `x-device-token` = your enrolled device token
9. Request body: **JSON**, with these exact keys:
   - `message_id` = generated UUID
   - `from` = sender phone number in E.164 format
   - `text` = incoming message text
10. Use **Get Dictionary from Input** on the API response. Read `status`, `reply`, and `event_id`.

**C. Decide whether to send**

11. If `reply` is empty or null, do not send anything. End the Shortcut. This includes disabled, suppressed, duplicate, cooldown, and no-rule responses.
12. If `reply` contains text and `event_id` exists, continue.
13. Use **Send Message** with:
   - Message: the returned `reply`
   - Recipient: the original incoming sender
   - If the action exposes a line/SIM selector, choose the intended SIM/eSIM. If not, iOS chooses according to its Messages settings/conversation preference.
14. Do not add a second, hard-coded reply. The dashboard's returned text is authoritative.

**D. Report the send action result**

15. If Send Message completes successfully, call:
   `POST https://YOUR-API-DOMAIN/api/device/auto-reply/EVENT_ID/report`
   with header `x-device-token` and JSON body `{"status":"SENT"}`.
16. If Send Message fails and Shortcuts exposes an error branch, call the same endpoint with `{"status":"FAILED","error":"SHORTCUT_ERROR_TEXT"}`.
17. Replace EVENT_ID with the API response's event_id. Do not report SENT before the Send Message action has completed.

## Report request details

- URL: `/api/device/auto-reply/{eventId}/report`
- Method: POST
- Headers: `Content-Type: application/json`, `x-device-token: DEVICE_TOKEN`
- JSON body on success: `{"status":"SENT"}`
- JSON body on failure: `{"status":"FAILED","error":"..."}`

A SENT report means the iOS Send Message action completed without returning an error. It is **not** proof of carrier delivery or recipient read status.

## Test checklist

1. Keep the global switch OFF and confirm that the API returns no reply.
2. Enable global auto-reply and create a default rule with a harmless test response.
3. Enable only one test iPhone.
4. Send a message from a phone you control.
5. Confirm the iPhone receives the incoming message automation.
6. Confirm the API response contains the exact dashboard message.
7. Confirm the iPhone sends that exact message using the intended SIM/eSIM.
8. Confirm the event appears in dashboard history as SENT.
9. Test a keyword rule and a device-specific override; confirm device rule priority.
10. Send STOP and confirm it is suppressed and the sender is added to the global suppression list.
11. Test a duplicate API request using the same message_id; it must not send another reply.
12. Disable auto-reply and verify that no new replies are sent.

## Troubleshooting

- **Automation never runs:** Review the Message trigger, iOS automation run mode, notification/Focus settings, and test with the iPhone unlocked. iOS may limit execution.
- **401 Unauthorized:** Confirm the enrolled device token is correct and the device has not been revoked.
- **400 Bad Request:** Check that the sender is E.164, the message_id is present, and text is not empty.
- **No reply:** Check global master switch, device switch, rule enabled state, keyword/default rule and cooldown, then inspect dashboard history.
- **Reply action asks for confirmation:** iOS is requiring user interaction. The backend cannot bypass that prompt.
- **Wrong SIM:** Review the Messages app's preferred line/conversation behavior and the Send Message action's available line selector. Validate with a test message before enabling.
- **Timeout:** Do not automatically retry with a new message_id. Reuse the same UUID for the same incoming event, inspect the API response, and avoid duplicate sending.

## Security

- Keep the device token private. Anyone with it can act as that enrolled device until it is revoked.
- Use HTTPS only.
- Never store a device token in the repository, dashboard rule text, or event logs.
- Revoke and re-enroll a device if its token is exposed.
