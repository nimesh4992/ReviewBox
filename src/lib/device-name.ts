/**
 * Turning Google Play's device fields into something a support agent can read.
 *
 * `userComment.device` is documented by Google as "Codename for the reviewer's
 * device, e.g. klte, flounder" — the Android build codename, not a name any
 * human recognises. Shipping it raw is how a review ended up labelled
 * "Spacewar" in the review pane: correct data, useless to the person reading it.
 *
 * `userComment.deviceMetadata` carries the readable pair in the same response
 * — `manufacturer` ("Motorola") and `productName` ("Droid") — we simply were
 * not reading them.
 */

export interface PlayDeviceMetadata {
  manufacturer?: string | null;
  productName?: string | null;
}

/** Collapse whitespace and trim; empty/whitespace-only becomes null. */
function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Best human-readable device label, or the codename when that is all we have.
 *
 * Prefers "Manufacturer ProductName", skipping the manufacturer when the
 * product name already carries it (Google sends both "Google"/"Pixel 7" and
 * "Xiaomi"/"Xiaomi 13", and "Xiaomi Xiaomi 13" reads like a bug).
 *
 * Falls back to the codename rather than dropping the field: for crash triage
 * an unrecognisable codename is still lookup-able, whereas a blank line tells
 * the agent nothing at all.
 */
export function formatDeviceName(
  codename: string | null | undefined,
  metadata?: PlayDeviceMetadata | null,
): string | null {
  const product      = clean(metadata?.productName);
  const manufacturer = clean(metadata?.manufacturer);

  if (product) {
    if (!manufacturer) return product;
    const alreadyPrefixed = product.toLowerCase().startsWith(manufacturer.toLowerCase());
    return alreadyPrefixed ? product : `${manufacturer} ${product}`;
  }

  // No product name. The manufacturer alone ("Samsung") is more useful than a
  // codename to most readers, but only if we can pair it with the codename —
  // "Samsung" on its own could be any of two hundred phones.
  const code = clean(codename);
  if (manufacturer && code) return `${manufacturer} (${code})`;

  return code ?? manufacturer;
}
