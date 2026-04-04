# Sentinel

Pay-per-use AI API marketplace on **Algorand**. Creators publish services with ALGO-based pricing; users pay on-chain and call a secure proxy that forwards requests to providers (OpenAI, Groq, Anthropic, Together) without exposing creator API keys.

## Team Sentinels

**Team Members:**

- Aarya Pawar  
- Manas Shete  
- Debjit Debnath  
- Aayush Lathi  

## Repository layout

| Path | Description |
|------|-------------|
| `Ignition-Team-Sentinal-aarya/backend/` | Express API, MongoDB (Mongoose), Algorand indexer/algod integration |
| `Ignition-Team-Sentinal-aarya/frontend/` | Vite + React + Tailwind; Pera wallet |
| `Ignition-Team-Sentinal-aarya/contract/` | Algorand smart contract (Puya/algopy), deploy script, artifacts |

## Quick start

### Backend

```bash
cd Ignition-Team-Sentinal-aarya/backend
npm install
npm run dev
```

Create `backend/.env` with at least `MONGODB_URI` (or `MONGO_URI`), `JWT_SECRET`, and `ENCRYPTION_KEY`. See `server.js` and route files under `src/routes/` for optional Algorand and contract variables.

### Frontend

```bash
cd Ignition-Team-Sentinal-aarya/frontend
npm install
npm run dev
```

Optional: `VITE_API_URL` for a non-proxied API base. Local dev often proxies `/api` via `vite.config.js`.

### Contract (optional)

```bash
cd Ignition-Team-Sentinal-aarya/contract
python -m venv .venv
# activate venv, then:
pip install -r requirements.txt
python deploy.py
```

Deploy writes `contract_info.json`; the backend can also read `ALGO_APP_ID` / `ALGO_CONTRACT_ADDRESS`.

## Highlights

- **JWT + wallet login** for `user` and `creator` roles  
- **Metered AI calls** via `/api/use` (quote → on-chain payment → completion with cached response)  
- **Service onboarding** with encrypted provider keys  
- **Optional** on-chain top-up flow and contract stats; optional proof-of-intelligence logging  

## License

Add a license if this project is open source.
