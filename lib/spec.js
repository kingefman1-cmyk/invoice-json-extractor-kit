export const SPEC = {
  "title": "Invoice Extractor",
  "tagline": "Turn invoice text into JSON.",
  "method": "POST",
  "path": "/api/extract",
  "button": "Extract",
  "headline": [
    "invoice_number",
    "currency",
    "total",
    "partial"
  ],
  "fields": [
    {
      "name": "text",
      "label": "Invoice text",
      "type": "textarea",
      "placeholder": "Paste the text of an invoice",
      "required": true,
      "maxlength": 20000,
      "rows": 10
    }
  ]
}
