# YNSG Ad Set — November 2026

30 finished ad images: 5 campaigns × English and Spanish × 3 Meta placements. Every ad uses a real job photo, the approved logo on white, brand colors (navy #10283C, forest #2F5B3F, sun #EDBD6B), the Outfit font, and the website written as **YourNeighborhoodServiceGuy.com**. No phone number appears anywhere, and nothing claims insurance or certification.

| Size | Use it for | Text safe zone |
|---|---|---|
| `square-1080x1080` | Facebook/Instagram feed, Marketplace, Google Business posts | 108px margins kept |
| `portrait-1080x1350` | **Best for feed**: takes the most screen on phones | 135px margins kept |
| `story-1080x1920` | Stories and Reels covers | Copy stays between 269px from the top and 672px from the bottom (Meta UI zones) |

**Spanish ads:** the website is English-only right now. Run the `-es-` versions only when you're ready to take a Spanish-speaking customer's request: a translated text thread is fine, but reply in Spanish. Kane County is 33.5% Hispanic, and 32% of households there speak a language other than English at home (Census QuickFacts), so this audience is large and competitors underserve it.

---

## 1. Accessibility & home safety (`accessibility/`) — run year-round
**Photo:** real wheelchair adjustment; resident's personal photos blurred, no faces.
**Primary text (EN):** New: grab bars, wheelchair and walker tune-ups, lever handles and lower closet shelves. Practical help so you or someone you love can stay safe at home. Seniors 70+, veterans, single parents and neighbors with disabilities can ask for our $45/hr Community Rate.
**Headline:** Safer at home, starting this week
**Description:** Published rates · DeKalb to St. Charles
**Primary text (ES):** Nuevo: barras de apoyo, ajuste de sillas de ruedas y andaderas, manijas de palanca y repisas más bajas. Ayuda práctica para que usted o un ser querido viva seguro en casa. Mayores de 70, veteranos, padres solteros y personas con discapacidad pueden pedir nuestra Tarifa Comunitaria de $45/hora.
**Headline (ES):** Más seguro en casa, desde esta semana
**Landing page:** /accessibility-home-safety-dekalb-il
**Who to target:** adult children ages 40–65 within 25 miles (they book for parents), plus ages 65+. Also share in caregiver and senior Facebook groups, and leave printed copies at senior centers, the VFW and the American Legion.

## 2. Leaf before/after (`leaf-before-after/`) — run now through early December
**Primary text (EN):** Same driveway, same afternoon. Walks, drives and beds cleared, and you approve the estimate and a not-to-exceed cap before we start.
**Headline:** Leaf season, handled
**Primary text (ES):** La misma entrada, la misma tarde. Banquetas, entradas y jardineras limpias, y usted aprueba el presupuesto y un límite de costo antes de empezar.
**Landing page:** /leaf-cleanup-dekalb-il

## 3. Holiday-ready visit (`holiday-ready/`) — **stop running after December 24**
**Primary text (EN):** Guests coming? One two-hour visit: shelves, pictures, curtain rods, furniture and small fixes. $140, or $90 at the Community Rate. Through December 24.
**Headline:** Holiday-ready in one visit
**Primary text (ES):** ¿Vienen visitas? Una visita de dos horas: repisas, cuadros, cortineros, muebles y arreglos pequeños. $140, o $90 con la Tarifa Comunitaria. Hasta el 24 de diciembre.
**Landing page:** /handyman-dekalb-il

## 4. Trusted neighbor (`trusted-neighbor/`) — always-on brand ad
**Primary text (EN):** Locally owned home and yard help from DeKalb to St. Charles. Published rates, and you approve a not-to-exceed cap before any work begins.
**Headline:** Your neighbor. Your service guy.
**Primary text (ES):** Ayuda local para el hogar y el jardín, de DeKalb a St. Charles. Precios publicados, y usted aprueba un límite de costo antes de empezar.

## 5. Winter list (`winter-list/`) — run now until the first snow
**Primary text (EN):** Get on our snow list before the first storm: driveways, walks and accessible entries, priced per visit.
**Headline:** Snow season? Get on the list.
**Primary text (ES):** Apúntese en nuestra lista antes de la primera nevada: entradas, banquetas y accesos, con precio por visita.
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
node make-ads.cjs ../../job-photos ../../ads
```
Edit the `ADS` list in `make-ads.cjs` to change copy, swap photos or add a campaign.
