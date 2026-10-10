# iOS Shortcut: add a transaction from a screenshot

Replaces the old n8n workflow. The Shortcut sends the screenshot's text to the backend, which reads it with AI and saves the transaction.

## 1. Get a token

In the app: Settings → Security → Shortcut token → Generate token. Copy it; it is shown once. Regenerate or revoke it there at any time (both stop the old token immediately). Changing your password also revokes it.

## 2. Build the Shortcut

1. **Take Screenshot**
2. **Extract Text from Image** (input: Screenshot)
3. **Get Contents of URL**
   - URL: `https://finance-api.umeh.me/api/capture/text` (local: `http://localhost:8000/api/capture/text`)
   - Method: POST
   - Headers: `Authorization` = `Bearer <your token>`
   - Request Body: JSON, field `text` (Text) = *Extracted Text*
4. **Get Dictionary Value** for key `message` from *Contents of URL*
5. **Show Notification** with *Dictionary Value*

Success shows e.g. "Added -₩6,500 Latte · Coffee · KRW Main". Failures show a short reason, e.g. "Couldn't find an amount", "No USD wallet", "Invalid or missing API token", or "Too many captures, try again in an hour." (limit: 30 captures per hour, shared with in-app photo scans).

Tip: run it from Back Tap or the Action button right after paying.

## Server setup

Set `GEMINI_API_KEY` (a Google AI Studio key) in `backend/.env`. Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`). Without a key, capture answers "AI capture isn't set up". On the Gemini free tier, Google may use the text and images you send to improve its products.

To try extraction without the Shortcut: `cd backend && npm run try-capture -- "STARBUCKS 6,500원 10/09 14:20 신한카드 승인"` (uses your quota).
