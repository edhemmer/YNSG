# YNSG Ad Set v2 — November 2026

40 finished ads: 5 campaigns × English and Spanish × 3 still sizes, **plus a motion Reel for each** (`-reel-1080x1920.mp4`, 8–10 seconds, silent, so add trending audio in the Facebook app). Every still has a hook headline, three check marks you can read at a glance, an offer sticker where there is a real price, and one clear button. Every ad uses a real job photo, the approved logo on white, brand colors (navy #10283C, forest #2F5B3F, sun #EDBD6B), the Outfit font, and the website written as **YourNeighborhoodServiceGuy.com**. No phone number appears anywhere, and nothing claims insurance or certification.

| Size | Use it for | Text safe zone |
|---|---|---|
| `square-1080x1080` | Facebook/Instagram feed, Marketplace, Google Business posts | 108px margins kept |
| `portrait-1080x1350` | **Best for feed**: takes the most screen on phones | 135px margins kept |
| `story-1080x1920` | Stories and Reels covers | Copy stays between 269px from the top and 672px from the bottom (Meta UI zones) |

**Spanish ads:** these are ready to run now. They send people to Facebook Messenger ("Escríbanos en español"), not the English website. Captions, Messenger reply scripts, organic posts, a glossary and a printable flyer are in `marketing/spanish/`.

---

## 1. Accessibility & home safety (`accessibility/`) — run year-round
**Photo:** real wheelchair adjustment; resident's personal photos blurred, no faces.
**Primary text (EN):** New: grab bars, wheelchair and walker tune-ups, lever handles and lower closet shelves. Practical help so you or someone you love can stay safe at home. Seniors 70+, veterans, single parents and neighbors with disabilities can ask for our $45/hr Community Rate.
**Headline:** Help Mom & Dad stay safe at home
**Description:** No trip charges · DeKalb to St. Charles
**Primary text (ES):** Nuevo: barras de apoyo, ajuste de sillas de ruedas y andaderas, manijas de palanca y repisas más bajas. Ayuda práctica para que usted o un ser querido viva seguro en casa. Mayores de 70, veteranos, padres solteros y personas con discapacidad pueden pedir nuestra Tarifa Comunitaria de $45/hora.
**Headline (ES):** Más seguro en casa, desde esta semana
**Landing page:** /accessibility-home-safety-dekalb-il
**Who to target:** adult children ages 40–65 within 25 miles (they book for parents), plus ages 65+. Also share in caregiver and senior Facebook groups, and leave printed copies at senior centers, the VFW and the American Legion.

## 2. Leaf before/after (`leaf-before-after/`) — run now through early December
**Primary text (EN):** Same driveway, same afternoon. Walks, drives and beds cleared, and you approve the estimate and a not-to-exceed cap before we start. No trip charges.
**Headline:** Leaves gone. Weekend back.
**Primary text (ES):** La misma entrada, la misma tarde. Banquetas, entradas y jardineras limpias, y usted aprueba el presupuesto y un límite de costo antes de empezar. Sin cargo por traslado.
**Landing page:** /leaf-cleanup-dekalb-il

## 3. Holiday-ready visit (`holiday-ready/`) — **stop running after December 24**
**Primary text (EN):** Guests coming? One two-hour visit: shelves, pictures, curtain rods, furniture and small fixes. $140, or $90 at the Community Rate. Through December 24.
**Headline:** Guests coming? We’ve got your list.
**Primary text (ES):** ¿Vienen visitas? Una visita de dos horas: repisas, cuadros, cortineros, muebles y arreglos pequeños. $140, o $90 con la Tarifa Comunitaria. Hasta el 24 de diciembre.
**Landing page:** /handyman-dekalb-il

## 4. Trusted neighbor (`trusted-neighbor/`) — always-on brand ad
**Primary text (EN):** Locally owned home and yard help from DeKalb to St. Charles. Published rates, no trip charges, and you approve a not-to-exceed cap before any work begins.
**Headline:** The service guy who actually shows up.
**Primary text (ES):** Ayuda local para el hogar y el jardín, de DeKalb a St. Charles. Precios publicados, sin cargo por traslado, y usted aprueba un límite de costo antes de empezar.

## 5. Winter list (`winter-list/`) — run now until the first snow
**Primary text (EN):** Get on our snow list before the first storm: driveways, walks and accessible entries, priced per visit. No trip charges.
**Headline:** First snow? Not your problem.
**Primary text (ES):** Apúntese en nuestra lista antes de la primera nevada: entradas, banquetas y accesos, con precio por visita. Sin cargo por traslado.
**Landing page:** /snow-removal-dekalb-il

---

## Running them on a small budget
- **Start with $5–$10/day per campaign**, and run only two campaigns at a time: Accessibility plus whichever seasonal ad fits (Leaf now, then Holiday, then Winter). In Ads Manager, choose a **25-mile radius around DeKalb + St. Charles**, the **Leads** or **Traffic** objective, and Advantage+ placements, and upload all 3 sizes so Meta uses the right one per spot.
- **Free first:** post every ad organically on your Facebook Page, in Google Business Profile updates, Nextdoor and local Facebook groups (follow each group's rules) before you pay to boost anything.
- **Judge after 7 days:** keep the ad with the lowest cost per request, then pause the rest.
- Paid ads cost money. Per your rule, nothing here was purchased or scheduled. You decide the budget in Meta Business Suite.

## Rebuilding or adding ads
The generator in `marketing/tools/ad-generator/` renders every size and language from the photo library:
```
cd marketing/tools/ad-generator
npm i --no-save @fontsource/outfit@5.2.8 playwright
node make-ads.cjs ../../job-photos ../../ads all   # needs ffmpeg for Reels
```
Edit the `ADS` list in `make-ads.cjs` to change copy, swap photos or add a campaign.

## Posting the Reels
Upload the `.mp4` as a Reel in Meta Business Suite, add a trending sound, and pin a comment with the website. Reels get far more free reach than still posts, so post one every week even without ad spend.
