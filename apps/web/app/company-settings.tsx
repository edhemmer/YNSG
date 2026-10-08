"use client";
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from "react";
import {settingsIssue,settingsFieldLabel,type SettingsIssue} from "../lib/settings-validation";
import {configurationCommand} from "../../../packages/contracts/operations";
import type { CompanySettings } from "../../../packages/contracts";
import {
  validateConfiguration,
  releaseGates,
} from "../../../packages/domain/configuration";
import { sessionFetch } from "../lib/session-fetch";
import { clockLabel, clockOptions } from "../lib/settings-display";
const categories = [
  [
    "Lawn care",
    "Mow, trim, blow and leaf management.",
    "No herbicides; yard size and access require review.",
  ],
  [
    "Yard & garden",
    "Pull weeds, trim small bushes, plant small bushes and flowers; pick up, deliver and apply bulk or bagged mulch.",
    "No herbicides. Customer prepays supplier for mulch and larger items. Hourly labor starts at supplier pickup; one minimum for combined work.",
  ],
  [
    "Help around the home",
    "Small home jobs reviewed individually before a quote.",
    "No ladders or work above five feet. Regulated work requires separate compliance review.",
  ],
  [
    "Snow clearing",
    "Shovel or snow-blow residential driveways and sidewalks.",
    "No salt; no road or parking-lot plowing.",
  ],
  [
    "Concrete pressure washing",
    "Residential driveway, walkway and patio concrete washing.",
    "Customer supplies accessible outdoor water. Surface, drainage and runoff require review.",
  ],
  [
    "Something else",
    "Review the requested work and feasibility before offering service.",
    "No automatic rate or scope commitment. Farmer contract labor: call to discuss work and rate.",
  ],
] as const;
type CatalogItem = {
  name: string;
  scope: string;
  exclusions: string;
  compliance: "review" | "approved" | "held";
  pricingMode: "hourly" | "starting" | "quote" | "review";
  existing?: boolean;
};
const ynsgCatalog = (): CatalogItem[] =>
  categories.map(([name, scope, exclusions]) => ({
    name,
    scope,
    exclusions,
    compliance: "review",
    pricingMode: name === "Something else" ? "review" : "hourly",
  }));
function settingsError(error: unknown): string {
  return settingsIssue(error)?.message || publicError(error, "Settings could not be saved. Refresh and try again.");
}
function template(name: string, organization: string): CompanySettings {
  return {
    schemaVersion: 1,
    displayName: name,
    timezone: "America/Chicago",
    currency: "USD",
    region: "IL",
    policyVersion: "ynsg-2026-10-02",
    privacyVersion: "ynsg-2026-10-02",
    cities: ["DeKalb", "Sycamore", "Cortland"],
    brand: {
      navy: "#10283c",
      forest: "#315842",
      gold: "#edbd6b",
      cream: "#f8f6ef",
      ownerName: organization === "a933d657-14d3-46b6-85e6-21d973e4ed97" ? "Ed Hemmer" : null,
      logoUrl: organization === "a933d657-14d3-46b6-85e6-21d973e4ed97" ? "https://www.yourneighborhoodserviceguy.com/assets/logo.jpg" : null,
    },
    sender: "edhemmer@gmail.com",
    notificationRecipient: "edhemmer@gmail.com",
    intakeEnabled: false,
    hourly: {
      standardCents: 6000,
      communityCents: 4500,
      minimumMinutes: 120,
      incrementMinutes: 30,
      partialExtension: null,
    },
    scheduling: {
      weekdays: [1, 2, 3, 4, 5],
      earliestStart: 480,
      latestStart: 900,
      endOfDay: 1020,
      bufferMinutes: 30,
      selectionMinutes: 10,
      proposalMinutes: 120,
      leadMinutes: 1440,
      horizonMinutes: 43200,
      pendingLimit: 1,
    },
    sellerLegalName: "",
    sellerVerified: false,
    invoiceTerms: null,
    taxTreatmentVerified: false,
    laborTaxTreatment: "unreviewed",
    review: organization === "a933d657-14d3-46b6-85e6-21d973e4ed97" ? {enabled:true,url:"https://g.page/r/CWxW2KabD1UWECE/review"} : { enabled: false, url: null },
  };
}
export default function CompanySettingsPanel({
  organization,
  name,
}: {
  organization: string;
  name: string;
}) {
  const [draft, setDraft] = useState<CompanySettings | null>(null),
    [version, setVersion] = useState(0),
    [catalog, setCatalog] = useState<CatalogItem[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [preview, setPreview] = useState(false),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true);
  const formRef=useRef<HTMLFormElement>(null);
  const [fieldIssue,setFieldIssue]=useState<SettingsIssue|null>(null);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setDraft(null);
    setCatalog([]);
    setVersion(0);
    setReady(false);
    setPreview(false);
    setMessage("");
    setError("");
    setFieldIssue(null);
    retry.current = null;
    void sessionFetch(
      "/api/configuration?organization=" + encodeURIComponent(organization),
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Unable to load settings");
        if (live) setReady(d.ready === true);
        if (live && d.configuration) {
          setVersion(d.configuration.version);
          setDraft(d.configuration.settings);
          setCatalog(
            (d.catalog || []).map(
              (c: {
                name: string;
                scope: string;
                exclusions: string;
                compliance: CatalogItem["compliance"];
                pricing_mode: CatalogItem["pricingMode"];
              }) => ({
                name: c.name,
                scope: c.scope,
                exclusions: c.exclusions,
                compliance: c.compliance,
                pricingMode: c.pricing_mode,
                existing: true,
              }),
            ),
          );
        }
      })
      .catch((e) => {
        if (live) setError(publicError(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organization]);
  const change = (patch: Partial<CompanySettings>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setPreview(false);
    setFieldIssue(null);
    setError("");
  };
  const clock = (
    label: string,
    key: "earliestStart" | "latestStart" | "endOfDay",
  ) => (
    <label key={key}>
      {label}
      <select
        required
        name={"scheduling."+key}
        value={draft!.scheduling[key]}
        onChange={(e) =>
          change({
            scheduling: { ...draft!.scheduling, [key]: Number(e.target.value) },
          })
        }
      >
        {clockOptions(draft!.scheduling[key], key === "endOfDay").map(
          (time) => (
            <option key={time} value={time}>
              {clockLabel(time)}
            </option>
          ),
        )}
      </select>
    </label>
  );
  const duration = (
    label: string,
    key:
      | "bufferMinutes"
      | "selectionMinutes"
      | "proposalMinutes"
      | "leadMinutes"
      | "horizonMinutes",
    unit: "minutes" | "hours" | "days",
    help: string,
  ) => (
    <label key={key}>
      {label} ({unit})
      <input
        type="number"
        name={"scheduling."+key}
        required
        min={
          key === "bufferMinutes" || key === "leadMinutes"
            ? 0
            : unit === "hours"
              ? 1 / 60
              : 1
        }
        step={unit === "minutes" ? 1 : "any"}
        value={
          draft!.scheduling[key] === null
            ? ""
            : draft!.scheduling[key]! / (unit === "days" ? 1440 : unit === "hours" ? 60 : 1)
        }
        onChange={(e) =>
          change({
            scheduling: {
              ...draft!.scheduling,
              [key]:
                e.target.value === ""
                  ? null
                  : Math.round(
                      Number(e.target.value) * (unit === "days" ? 1440 : unit === "hours" ? 60 : 1),
                    ),
            },
          })
        }
      />
      <small>{help}</small>
    </label>
  );
  function showIssue(issue:SettingsIssue) {
    setPreview(false);setFieldIssue(issue);setError(issue.message);
    const form=formRef.current;if(!form)return;
    const controls=Array.from(form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea'));
    controls.forEach(control=>{control.removeAttribute('aria-invalid');control.removeAttribute('aria-errormessage');});
    const target=controls.find(control=>control.name===issue.path);
    if(target){target.setAttribute('aria-invalid','true');target.setAttribute('aria-errormessage','settings-field-error');requestAnimationFrame(()=>{if(target.isConnected){target.scrollIntoView({behavior:'auto',block:'center'});target.focus({preventScroll:true});}});}
  }
  function previewSettings(form:HTMLFormElement) {
    if(!draft)return;
    const invalid=Array.from(form.elements).find((element):element is HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement=>(element instanceof HTMLInputElement||element instanceof HTMLSelectElement||element instanceof HTMLTextAreaElement)&&element.willValidate&&!element.validity.valid);
    if(invalid){showIssue({path:invalid.name,message:settingsFieldLabel(invalid.name)+': '+(invalid.validity.valueMissing?'Please complete this field.':invalid.validationMessage)});return;}
    try{
      validateConfiguration(draft);
      configurationCommand.parse({organizationId:organization,expectedVersion:version,key:'settings-preview-validation',settings:draft,catalog:catalog.map(({existing,...item})=>item)});
      setError('');setFieldIssue(null);setPreview(true);
      form.querySelectorAll('[aria-invalid]').forEach(control=>{control.removeAttribute('aria-invalid');control.removeAttribute('aria-errormessage');});
    }catch(error){const issue=settingsIssue(error);if(issue)showIssue(issue);else setError(settingsError(error));}
  }
  async function publish() {
    if (!draft) return;
    setPending(true);
    setError("");
    try {
      const settings = validateConfiguration(draft);
      const publishedCatalog = catalog.map(({ existing, ...item }) => item);
      const value = {
        organizationId: organization,
        expectedVersion: version,
        settings,
        catalog: publishedCatalog,
      };
      const fingerprint = JSON.stringify(value);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: crypto.randomUUID() };
      const r = await sessionFetch("/api/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, key: retry.current.key }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setVersion(d.result.version);
      setCatalog((c) => c.map((v) => ({ ...v, existing: true })));
      setPreview(false);
      setMessage(
        "Settings version " +
          d.result.version +
          " published. Google and customer delivery remain separately controlled.",
      );
    } catch (e) {
      const issue=settingsIssue(e);if(issue)showIssue(issue);else setError(settingsError(e));
    } finally {
      setPending(false);
    }
  }
  const settingsFormId = "company-settings-" + organization;
  return (
    <section
      className="card company-settings"
      aria-labelledby="settings-heading"
    >
      <h2 id="settings-heading" tabIndex={-1}>Company settings</h2>
      <p>
        Review business details and operating rules before publishing. These
        settings do not activate Google or customer emails.
      </p>
      {!ready && !loading && (
        <p className="note">
          Publishing awaits the approved database rollout. You can review the
          template here.
        </p>
      )}
      {draft && <div className="settings-actions" role="group" aria-label="Save company settings">
        <p>{preview ? "Review your settings, then publish to save them." : "Changes are saved when you preview and publish them."}</p>
        {fieldIssue && <p id="settings-field-error" role="alert">{fieldIssue.message}</p>}
        {fieldIssue && <button type="button" className="secondary" onClick={()=>showIssue(fieldIssue)}>Go to this field</button>}
        {preview && <p>{draft.displayName} · {draft.timezone} · Standard ${draft.hourly.standardCents / 100}/hour · Community ${draft.hourly.communityCents / 100}/hour</p>}
        {preview ? <button type="button" disabled={pending || !ready} onClick={() => void publish()}>{pending ? "Saving…" : "Publish reviewed settings"}</button> : <button type="submit" form={settingsFormId} disabled={pending}>Preview settings to save</button>}
      </div>}
      {error && !fieldIssue && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Loading your company settings…</p>
      ) : !draft ? (
        <>
          <p>
            No settings are published yet. The YNSG template is a starting point
            for your review.
          </p>
          <button
            onClick={() => {
              setDraft(template(name,organization));
              setCatalog(ynsgCatalog());
              setVersion(0);
            }}
          >
            Review YNSG settings template
          </button>
        </>
      ) : (
        <form
          id={settingsFormId}
          ref={formRef}
          noValidate
          onInput={()=>{if(fieldIssue){setFieldIssue(null);setError("");formRef.current?.querySelectorAll("[aria-invalid]").forEach(control=>{control.removeAttribute("aria-invalid");control.removeAttribute("aria-errormessage");});}}}
          onSubmit={(e) => {
            e.preventDefault();
            previewSettings(e.currentTarget);
          }}
        >
          <fieldset disabled={pending}>
            <legend>Business and email</legend>
            <label>
              Name shown to customers
              <input
                required
                name="displayName"
                value={draft.displayName}
                onChange={(e) => change({ displayName: e.target.value })}
              />
            </label>
            <label>
              Business name
              <input
                required
                minLength={2}
                name="sellerLegalName"
                value={draft.sellerLegalName}
                onChange={(e) => change({ sellerLegalName: e.target.value })}
              />
              <small>
                The name of the business or owner responsible for the work. Used
                on invoices and agreements.
              </small>
            </label>
            <label>
              Timezone
              <input
                required
                name="timezone"
                value={draft.timezone}
                onChange={(e) => change({ timezone: e.target.value })}
              />
            </label>
            <label>
              State or region
              <input
                required
                name="region"
                value={draft.region}
                onChange={(e) => change({ region: e.target.value })}
              />
            </label>
            <label>
              Service cities, separated by commas
              <input
                required
                name="cities"
                value={draft.cities.join(", ")}
                onChange={(e) =>
                  change({
                    cities: e.target.value.split(",").map((s) => s.trim()),
                  })
                }
              />
            </label>
            <label>
              Gmail sender
              <input
                type="email"
                required
                name="sender"
                value={draft.sender}
                onChange={(e) => change({ sender: e.target.value })}
              />
            </label>
            <label>
              Owner notification email
              <input
                type="email"
                required
                name="notificationRecipient"
                value={draft.notificationRecipient}
                onChange={(e) =>
                  change({ notificationRecipient: e.target.value })
                }
              />
            </label>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Email logo and signature</legend>
            <label>Owner name for email signature<input name="brand.ownerName" maxLength={160} value={draft.brand.ownerName || ""} placeholder="Your name" onChange={e=>change({brand:{...draft.brand,ownerName:e.target.value||null}})}/><small>Emails close with Best Regards, followed by this name.</small></label>
            <label>Logo image link<input name="brand.logoUrl" type="url" maxLength={2048} value={draft.brand.logoUrl || ""} placeholder="https://your-website.com/logo.png" onChange={e=>change({brand:{...draft.brand,logoUrl:e.target.value||null}})}/><small>Use a publicly accessible HTTPS image. Email readers may choose to hide images.</small></label>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>After an invoice is paid</legend>
            <p>A thank-you email queues when confirmed payments cover the full invoice. Sending requires your verified Google connection and enabled email delivery.</p>
            <label className="check"><input type="checkbox" checked={draft.review.enabled} onChange={e=>change({review:{...draft.review,enabled:e.target.checked}})} />Include a review request in the thank-you email</label>
            <label>Review page link (optional until enabled)<input name="review.url" type="url" placeholder="https://" required={draft.review.enabled} value={draft.review.url||''} onChange={e=>change({review:{...draft.review,url:e.target.value||null}})} /></label>
            {organization === "a933d657-14d3-46b6-85e6-21d973e4ed97" && <button type="button" className="secondary" onClick={()=>change({review:{enabled:true,url:"https://g.page/r/CWxW2KabD1UWECE/review"}})}>Use our Google review link</button>}
            <p>Use the HTTPS link where customers can leave a review. Leave this off until your review page is ready.</p>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Rates and invoices</legend>
            <label>
              Standard hourly rate ($)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                name="hourly.standardCents"
                value={draft.hourly.standardCents / 100}
                onChange={(e) =>
                  change({
                    hourly: {
                      ...draft.hourly,
                      standardCents: Math.round(Number(e.target.value) * 100),
                    },
                  })
                }
              />
            </label>
            <label>
              Community hourly rate ($)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                name="hourly.communityCents"
                value={draft.hourly.communityCents / 100}
                onChange={(e) =>
                  change({
                    hourly: {
                      ...draft.hourly,
                      communityCents: Math.round(Number(e.target.value) * 100),
                    },
                  })
                }
              />
            </label>
            <p>
              One two-hour minimum per combined visit. Community eligibility is
              reviewed, never inferred.
            </p>
            <label>
              Partial extension billing
              <select
                name="hourly.partialExtension"
                value={draft.hourly.partialExtension ?? ""}
                onChange={(e) =>
                  change({
                    hourly: {
                      ...draft.hourly,
                      partialExtension:
                        e.target.value === ""
                          ? null
                          : (e.target.value as "ceil" | "exact"),
                    },
                  })
                }
              >
                <option value="">Not approved yet</option>
                <option value="exact">Exact recorded minutes</option>
                <option value="ceil">Round up to the next 30 minutes</option>
              </select>
            </label>
            <label>
              Invoice terms
              <textarea
                name="invoiceTerms"
                maxLength={4000}
                value={draft.invoiceTerms ?? ""}
                onChange={(e) =>
                  change({ invoiceTerms: e.target.value || null })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.sellerVerified}
                onChange={(e) => change({ sellerVerified: e.target.checked })}
              />
              I confirm the business name is correct.
            </label>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Tax setup</legend>
            <label>
              Tax review status
              <select
                value={
                  draft.taxTreatmentVerified &&
                  draft.laborTaxTreatment === "reviewed_non_taxable"
                    ? "reviewed_non_taxable"
                    : "unreviewed"
                }
                onChange={(e) =>
                  change({
                    taxTreatmentVerified:
                      e.target.value === "reviewed_non_taxable",
                    laborTaxTreatment:
                      e.target.value === "reviewed_non_taxable"
                        ? "reviewed_non_taxable"
                        : "unreviewed",
                  })
                }
              >
                <option value="unreviewed">Not reviewed yet</option>
                <option value="reviewed_non_taxable">
                  Reviewed — this labor is non-taxable
                </option>
              </select>
            </label>
            <p>
              Choose the reviewed option only after checking the tax treatment
              for your services. This setting records your decision; it does not
              verify tax rules. Taxable or mixed charges need additional setup
              before invoicing.
            </p>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Appointment hours</legend>
            <p>
              Times use {draft.timezone}. Visits need at least two hours; you
              approve each proposed appointment.
            </p>
            <fieldset className="weekday-options">
              <legend>Working days</legend>
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name="scheduling.weekdays"
                    checked={draft.scheduling.weekdays.includes(index + 1)}
                    onChange={(e) =>
                      change({
                        scheduling: {
                          ...draft.scheduling,
                          weekdays: e.target.checked
                            ? [...draft.scheduling.weekdays, index + 1].sort(
                                (a, b) => a - b,
                              )
                            : draft.scheduling.weekdays.filter(
                                (d) => d !== index + 1,
                              ),
                        },
                      })
                    }
                  />
                  {day}
                </label>
              ))}
            </fieldset>
            <div className="settings-grid">
              {clock("First appointment arrival", "earliestStart")}
              {clock("Last appointment arrival", "latestStart")}
              {clock("Finish work by", "endOfDay")}
              {duration(
                "Time between appointments",
                "bufferMinutes",
                "minutes",
                "Allows time for travel and setup.",
              )}
            </div>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Booking rules</legend>
            <div className="settings-grid">
              {duration(
                "Hold while a customer selects a time",
                "selectionMinutes",
                "minutes",
                "Temporarily keeps the selected time available for that customer.",
              )}
              {duration(
                "Time to approve a proposed appointment",
                "proposalMinutes",
                "hours",
                "The proposal expires if you have not made a decision in this time.",
              )}
              {duration(
                "Minimum advance notice",
                "leadMinutes",
                "hours",
                "How far ahead a customer must request an appointment.",
              )}
              {duration(
                "How far ahead customers can book",
                "horizonMinutes",
                "days",
                "Use 30 days for one-time visits and the first visit in a weekly schedule.",
              )}
              <label>
                Pending alternatives per request
                <input
                  type="number"
                  required
                  min={1}
                  max={5}
                  step={1}
                  name="scheduling.pendingLimit"
                  value={draft.scheduling.pendingLimit}
                  onChange={(e) =>
                    change({
                      scheduling: {
                        ...draft.scheduling,
                        pendingLimit: Number(e.target.value),
                      },
                    })
                  }
                />
                <small>
                  Limits the number of proposed times held for one request.
                </small>
              </label>
            </div>
            <p>
              One-time visits and the first recurring visit are offered within
              the next 30 days, subject to your hours and minimum notice. Weekly
              requests keep the same local day and time for 12 months. Each
              appointment needs approval before it is confirmed.
            </p>
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Colors</legend>
            {(["navy", "forest", "gold", "cream"] as const).map((key) => (
              <label key={key}>
                {key}
                <input
                  name={"brand."+key}
                  type="color"
                  value={draft.brand[key]}
                  onChange={(e) =>
                    change({ brand: { ...draft.brand, [key]: e.target.value } })
                  }
                />
              </label>
            ))}
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Company service catalog</legend>
            <p>
              Set this company's services, exclusions and pricing approach. Keep
              a published name for historical references; mark a retired service
              Held instead of deleting it.
            </p>
            {catalog.map((item, index) => (
              <div className="card" key={index}>
                <label>
                  Service name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    readOnly={item.existing}
                    name={"catalog."+index+".name"}
                    value={item.name}
                    onChange={(e) => {
                      setCatalog((c) =>
                        c.map((v, i) =>
                          i === index ? { ...v, name: e.target.value } : v,
                        ),
                      );
                      setPreview(false);
                    }}
                  />
                </label>
                <label>
                  Included work
                  <textarea
                    required
                    minLength={10}
                    maxLength={4000}
                    name={"catalog."+index+".scope"}
                    value={item.scope}
                    onChange={(e) => {
                      setCatalog((c) =>
                        c.map((v, i) =>
                          i === index ? { ...v, scope: e.target.value } : v,
                        ),
                      );
                      setPreview(false);
                    }}
                  />
                </label>
                <label>
                  Exclusions and conditions
                  <textarea
                    required
                    minLength={10}
                    maxLength={4000}
                    name={"catalog."+index+".exclusions"}
                    value={item.exclusions}
                    onChange={(e) => {
                      setCatalog((c) =>
                        c.map((v, i) =>
                          i === index
                            ? { ...v, exclusions: e.target.value }
                            : v,
                        ),
                      );
                      setPreview(false);
                    }}
                  />
                </label>
                <label>
                  Scope approval
                  <select
                    name={"catalog."+index+".compliance"}
                    value={item.compliance}
                    onChange={(e) => {
                      setCatalog((c) =>
                        c.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                compliance: e.target
                                  .value as CatalogItem["compliance"],
                              }
                            : v,
                        ),
                      );
                      setPreview(false);
                    }}
                  >
                    <option value="review">Needs review</option>
                    <option value="approved">Approved</option>
                    <option value="held">Held — do not offer</option>
                  </select>
                </label>
                <label>
                  Pricing approach
                  <select
                    name={"catalog."+index+".pricingMode"}
                    value={item.pricingMode}
                    onChange={(e) => {
                      setCatalog((c) =>
                        c.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                pricingMode: e.target
                                  .value as CatalogItem["pricingMode"],
                              }
                            : v,
                        ),
                      );
                      setPreview(false);
                    }}
                  >
                    <option value="hourly">Hourly</option>
                    <option value="quote">Individual quote</option>
                    <option value="starting">
                      Starting rate — review required
                    </option>
                    <option value="review">Discuss and review</option>
                  </select>
                </label>
                {!item.existing && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setCatalog((c) => c.filter((_, i) => i !== index));
                      setPreview(false);
                    }}
                  >
                    Remove unpublished service
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              disabled={catalog.length >= 100}
              onClick={() => {
                setCatalog((c) => [
                  ...c,
                  {
                    name: "",
                    scope: "",
                    exclusions: "",
                    compliance: "review",
                    pricingMode: "review",
                  },
                ]);
                setPreview(false);
              }}
            >
              Add a service
            </button>
            <label>
              <input
                type="checkbox"
                checked={draft.intakeEnabled}
                onChange={(e) => change({ intakeEnabled: e.target.checked })}
              />
              Save website requests here after the connection is verified.
            </label>
          </fieldset>
          <p>
            Before issuing invoices:{" "}
            {releaseGates(draft).join("; ") ||
              "These invoice setup checks are complete."}
          </p>
          <p>You can publish settings while invoice decisions remain unreviewed. Invoicing stays blocked until those checks are complete.</p>
          <button disabled={pending}>Preview settings to save</button>
          {preview && (
            <div className="card">
              <h3>Publish version {version + 1}</h3>
              <p>
                {draft.displayName} · {draft.timezone} · standard $
                {draft.hourly.standardCents / 100}/hour · Community $
                {draft.hourly.communityCents / 100}/hour
              </p>
              <p>
                Website requests: {draft.intakeEnabled ? "enabled" : "disabled"}.
                Previously issued invoices keep their original details.
              </p>
              <button
                type="button"
                disabled={pending || !ready}
                onClick={() => void publish()}
              >
                Publish reviewed settings
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
