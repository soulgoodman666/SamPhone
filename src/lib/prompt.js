import { MODELS, STORAGES } from './constants.js'

export function buildExtractionPrompt({ url, description, imageCount }) {
  const listing = [
    url?.trim() ? `Listing URL:\n${url.trim()}` : 'Listing URL:\n(not provided)',
    '',
    'Listing description:',
    description?.trim() || '(not provided)',
    '',
    imageCount > 0
      ? `The user will attach ${imageCount} screenshot or product image(s) in this ChatGPT conversation. Read them together with the text.`
      : 'No image was prepared inside Samphone. Use only the text above unless the user also attaches images in this chat.',
  ].join('\n')

  return `You extract used iPhone listing data for a private reseller in East Java, Indonesia.

Read the Facebook Marketplace or Facebook group listing below. Return ONE JSON object and nothing else. Do not use markdown fences.

Rules:
- Do not invent information.
- Extract only facts supported by the listing text or the attached images.
- Keep seller claims, but add the field name to uncertain_fields when the claim is not independently visible.
- Use null for unknown numbers and booleans.
- Use an empty string for unknown text.
- Add every unknown field name to missing_fields.
- Preserve the original asking price as an integer in Indonesian Rupiah, without currency symbols. Dot separators are thousands separators.
- Use a standardized model name from this list when it matches: ${MODELS.join(', ')}.
- Use storage from this list when it matches: ${STORAGES.join(', ')}.
- Do not treat iPhone 14 Pro and iPhone 14 Pro Max, or any other model and its Max/Plus/mini variant, as the same phone.
- region must be "iBox", "Internasional", or "" if not stated.
- carrier_lock must be "unlocked", "locked", "rsim", or "".
- imei_status must be "registered", "unregistered", or "".
- icloud_status must be "clean", "locked", or "". Use "clean" or "locked" only if the seller or an image states it explicitly.
- battery_status must be "original", "replaced", or "".
- face_id and true_tone must be true, false, or null.
- battery_health must be a number from 0 to 100, or null.
- city and district should stay as written by the seller.
- Do not guess iCloud, IMEI, Face ID, battery health, or repair status.
- Do not say the phone is a good purchase.

Return exactly this JSON shape:
{
  "model": "",
  "storage": "",
  "color": "",
  "asking_price": null,
  "battery_health": null,
  "region": "",
  "city": "",
  "district": "",
  "face_id": null,
  "true_tone": null,
  "carrier_lock": "",
  "imei_status": "",
  "icloud_status": "",
  "battery_status": "",
  "parts_history": "",
  "physical_condition": "",
  "functional_condition": "",
  "repair_history": "",
  "seller_notes": "",
  "missing_fields": [],
  "uncertain_fields": []
}

Listing:
${listing}`
}
