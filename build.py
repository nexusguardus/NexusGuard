"""
NexusGuard — build.py
Static SEO page generator.
Reads data/states.json + seo-template.html, produces /states/*.html
"""

import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data", "states.json")
TEMPLATE_PATH = os.path.join(ROOT, "seo-template.html")
OUTPUT_DIR = os.path.join(ROOT, "states")


def fmt_currency(n):
    """Format a number as $X,XXX."""
    return f"${n:,.0f}"


def build_key_details_html(details):
    """Convert a list of strings into <li> elements."""
    items: list[str] = []
    for d in details:
        items.append(
            f'        <li class="flex items-start gap-3">'
            f'<span class="mt-1.5 w-2 h-2 rounded-full bg-brand-400 flex-shrink-0"></span>'
            f'<span class="text-gray-300 leading-relaxed">{d}</span>'
            f'</li>'
        )
    return "\n".join(items)


def main():
    # Load data
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        states = json.load(f)

    # Load template
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template = f.read()

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    generated = []

    for state in states:
        html = template

        # Dollar threshold formatted
        dollar_fmt = fmt_currency(state["dollarThreshold"])

        # Transaction threshold handling
        txn = state.get("transactionThreshold")
        if txn is not None:
            txn_display = f"{txn:,} transactions"
            txn_note = "separate transactions in the prior 12 months"
        else:
            txn_display = "N/A"
            txn_note = "this state does not have a separate transaction threshold"

        # Key details list
        key_details_html = build_key_details_html(state.get("keyDetails", []))

        # Replace all placeholders
        replacements = {
            "{{stateName}}": state["stateName"],
            "{{slug}}": state["slug"],
            "{{abbreviation}}": state["abbreviation"],
            "{{flag}}": state["flag"],
            "{{dollarThreshold}}": str(state["dollarThreshold"]),
            "{{dollarThresholdFmt}}": dollar_fmt,
            "{{transactionThreshold}}": str(txn) if txn else "N/A",
            "{{transactionThresholdDisplay}}": txn_display,
            "{{transactionThresholdNote}}": txn_note,
            "{{filingFrequency}}": state["filingFrequency"],
            "{{taxRate}}": state["taxRate"],
            "{{effectiveDate}}": state["effectiveDate"],
            "{{govPortalUrl}}": state["govPortalUrl"],
            "{{seoDescription}}": state["seoDescription"],
            "{{keyDetailsList}}": key_details_html,
        }

        for placeholder, value in replacements.items():
            html = html.replace(placeholder, value)

        # Write output
        out_path = os.path.join(OUTPUT_DIR, f"{state['slug']}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)

        generated.append(state["slug"])
        print(f"  ✓ states/{state['slug']}.html")

    print(f"\n✅ Generated {len(generated)} pages in /states/")


if __name__ == "__main__":
    main()
