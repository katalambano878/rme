# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyone in the household, essentials first: shoppers in Ghana buying everyday personal-care and home essentials (soaps, deodorants, detergents, toiletries, body lotions) as much as beauty and skincare, plus baby, hair and accessory items. They shop on phones and desktop, pay in Ghana cedis (GH₵) by Mobile Money, and want to find a familiar product fast, trust it is genuine, and get it delivered or pick it up.

The store's owner and staff run it day to day through the admin: orders, stock, POS sales at the counter, customer messages.

## Product Purpose

RonnyandMe Essentials (ronnyandme.com) is an online and in-person store for genuine beauty, personal-care and home essentials. Success: a shopper finds what they came for, trusts it, pays with Mobile Money in a few steps, and comes back for the next restock.

## Positioning

Shoppers choose RonnyandMe for four things together:

- **Genuine products.** Authentic items from trusted brands and suppliers (e.g. Olay, Neutrogena, Gillette, Palmolive), never fakes.
- **Ronny's personal picks and advice.** Ronny's own recommendations and routine help, including over WhatsApp, are part of why people buy.
- **Good prices and sales.** Competitive prices, discounts and store-wide sale events.
- **Fast delivery in Accra, easy pickup.** Quick doorstep delivery and pickup at Manet Ville Estates, East Airport Spintex, Accra; nationwide delivery beyond.

## Operating Context

- About 740 active products across 37 categories (lip care, body lotions and creams, deodorants, detergents and cleaning, facial care, hair, jewellery, baby products, scents and more). Many products have size and colour variants.
- Checkout is Mobile Money only (Moolre), in GH₵; delivery or store pickup; delivery fee confirmed by the store; free delivery over GH₵ 2,000.
- Guests can check out without an account; accounts keep orders and a wishlist. Order tracking works by order number plus email or phone.
- An AI chat helper on the site answers product and order questions; WhatsApp is the human support channel.
- Staff sell in person through the admin POS from the same catalogue.

## Capabilities and Constraints

- Next.js 16 storefront and admin on plain Postgres, deployed on Coolify (ronnyandme.com).
- Real product photos come from the admin; quality and backgrounds vary by product.
- Prices, sale prices and stock come from the database; sale pricing can run store-wide.
- Open: no "Ronny's picks" or curated-collection feature exists in the data yet; adding one is a product decision, not a design assumption.

## Brand Commitments

- Name **RonnyandMe** (RonnyandMe Essentials); the **R/ME monogram logo** stays exactly as it is (`public/brand/ronnyandme-logo.png`). Its wordmark reads "RONNY&MIMI'ESSENTIALS" with "WE'VE GOTCHA!!!" beneath, charcoal on a transparent background.
- Tagline **"We've gotcha!!!"** and its friendly, warm, reassuring voice stay.
- **Pink stays the signature brand colour.**

## Evidence on Hand

- Real catalogue: product names, photos, prices, categories and variants in the database.
- About-page values already written by the store: Quality, Authenticity, Glow First, Community; Curated selection, Nationwide delivery, Secure payments, Personal care support via WhatsApp.
- No customer testimonials, review counts at scale, press, or delivery-time guarantees on hand; do not invent them.

## Product Principles

1. **Find it fast.** Most visits are a restock of something familiar; search, categories and reorder beat browsing theatre.
2. **Trust is the product.** Genuineness, clear prices and honest stock should be visible where a shopper decides, not hidden in an About page.
3. **Ronny is the difference.** Ronny's picks and advice are a real reason to buy; give them a home without faking it where the data does not exist yet.
4. **Mobile Money in a few taps.** The path from bag to paid is short, clear and works well on a phone.
5. **Warm, not loud.** The "We've gotcha!!!" voice reassures; sales are celebrated without turning the store into a discount bin.

## Accessibility & Inclusion

Text meets WCAG AA contrast (4.5:1 body, 3:1 large); the current site's pale pink headings and labels fail this and must not return. Works well on mid-range Android phones and slower mobile data.
