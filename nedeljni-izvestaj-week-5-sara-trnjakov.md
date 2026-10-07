# Nedeljni izveštaj

## 1. Osnovne informacije

| Polje | Odgovor |
| --- | --- |
| Ime i prezime | Sara Trnjakov |
| Nedelja | Week 5 |
| Par / tim | Goran |
| Moj konkretan doprinos / uloga | Implementacija Feature 005 — Bounded Recovery Planner |
| Reference na rad i dokaze | `specs/005-bounded-recovery-planner/evidence.md`; 121 prolaznih testova; typecheck, build i produkcioni audit prolaze |

## 2. Moj status

**Status:** Implementacija završena i automatski proverena.

## 3. Rad ove nedelje

Implementirala sam Recovery Planner kao bezbednu, ograničenu AI funkcionalnost koja se aktivira nakon gubitka života. Igrač bira cilj `survive` ili `advance`, a aplikacija vraća savetodavni plan bez automatskog izvršavanja akcija u igri.

Moj rad je obuhvatio:

- Shared runtime validatore za recovery zahtev, model odluke, akcije, evaluaciju, finalni plan i javne HTTP odgovore.
- Deterministički evaluator `evaluate_recovery_plan`, koji ocenjuje niz od 2–4 dozvoljene akcije, izračunava score, viability i evidence.
- Strogi allowlist za jedini dozvoljeni alat, sa proverom argumenata, ponavljanja, timeout-om od 250 ms i limitom rezultata od 4 KB.
- Backend orkestrator sa ograničenjem od najviše 3 koraka, 2 tool poziva, 5 provider pokušaja, 2 pokušaja po koraku i ukupnim rokom od 35 sekundi.
- Novi endpoint `POST /api/recovery-plan`, uz očuvanje postojećeg `/api/hint` endpointa.
- Gemini adapter za recovery tok i redigovanu telemetriju bez ključeva, promptova, koordinata ili provider odgovora.
- Frontend kontrole za izbor cilja, prikaz summary-ja, akcija, evidence i confidence vrednosti.
- Nezavisno otkazivanje Recovery Planner zahteva i zaštitu od zastarelih odgovora nakon novog damage događaja, restarta ili izlaska iz sesije.
- Testove za validan plan, reviziju neviabilnog kandidata, odbijanje nepoznatog alata bez izvršavanja evaluator-a, shared ugovore i frontend parser.

## 4. Provere

- `npm.cmd run test` — prolazi svih 121 test (59 frontend, 55 backend i 7 shared-contract testova).
- `npm.cmd run typecheck` — prolazi.
- `npm.cmd run build` — prolazi.
- `npm.cmd audit --omit=dev --workspace @quattro-kong/backend` — nema produkcionih ranjivosti.

Ograničeni live Gemini poziv sa modelom `gemini-3.5-flash-lite` završen je
statusom `completed`. Završna reviewerska provera vratila je validiran plan
`avoid`, `climb` za cilj `survive`, sa četiri evidence činjenice i bez
automatskog menjanja igre. Browser smoke je obuhvatio stvarni gubitak života,
oba recovery cilja sa lokalnim fake odgovorima, eksplicitne statuse, postojeći
Hint, otkazivanje i stale suppression pri pauzi, restart i povratak u meni.

## 5. Sledeći korak

Sledeći korak je ručna proba pune postojeće win/loss rute, zatim zajednička
proba sedmominutnog demoa i finalna predaja.
