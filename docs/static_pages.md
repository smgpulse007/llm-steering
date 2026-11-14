# Static Pages and the local API

`npm run build:pages` selects Vite's explicit `pages` mode. Its API client uses the
bundled documentation and model registry instead of sending requests to `/api` on
GitHub's static host. Live model actions report that the local workbench API is
required; they do not send requests from a Pages build.

`npm run dev` and `npm run build` retain the normal API behavior. The development
proxy targets `http://127.0.0.1:8000` by default. Use the documented local API/model
setup for live experiment execution; publishing static files does not host Python
inference.

To check a Pages build locally, run `npm run build:pages`, then
`npm run preview:pages`, open `/llm-steering/`, and inspect the browser network tab.
The docs, Console, and Explainability views should render without requests to
`/api/*`. The favicon is bundled under the same deployment base path.
