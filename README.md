# openapi-fetch-tauri

This library is an [openapi-fetch](https://github.com/drwpow/openapi-typescript/tree/main/packages/openapi-fetch) clone that uses [Tauri's HTTP API](https://tauri.app/v1/api/js/http/). Because of this, it is a drop-in replacement for openapi-fetch, and can be used in the same way.
_Thanks, [@drwpow](https://github.com/drwpow)!_

> [!CAUTION]
> Due to limitations in the Tauri HTTP API, this library **only** supports JSON requests and responses.

## Usage

In order to get started, generate a specification file using [openapi-typescript](https://github.com/drwpow/openapi-typescript/tree/main/packages/openapi-typescript).

```sh
# Local schema...
npx openapi-typescript ./path/to/my/schema.yaml -o ./path/to/my/schem # npm
yarn dlx openapi-fetch-tauri ./path/to/my/schema.d.ts -o ./path/to/my/schema.ts # or yarn
pnpm dlx openapi-fetch-tauri ./path/to/my/schema.d.ts -o ./path/to/my/schema.ts # or pnpm
# 🚀 ./path/to/my/schema.yaml -> ./path/to/my/schema.d.ts [7ms]

# Remote schema...
npx openapi-typescript https://example.com/schema.yaml -o ./path/to/my/schema # npm
yarn dlx openapi-fetch-tauri https://example.com/schema.d.ts -o ./path/to/my/schema.ts # or yarn
pnpm dlx openapi-fetch-tauri https://example.com/schema.d.ts -o ./path/to/my/schema.ts # or pnpm
# 🚀 https://example.com/schema.yaml -> ./path/to/my/schema.d.ts [7ms]
```

Then, utilize the generated specification file to make requests. In order to do this, create a client like so:

```ts
import type { paths } from './path/to/my/schema';

export const client = createClient<paths>({
  baseUrl: 'https://example.com'
  // ... default options
});

# or

export const { GET, POST, DELETE /*, ...*/ } = createClient<paths>({
  baseUrl: 'https://example.com'
  // ... default options
});
```

Now, you can use the client to make requests that match the specification:

```ts
import { client } from './client';

const { data, error /*, response*/ } = await client.GET('/path/to/endpoint');

# or

import { GET } from './client';

const { data, error /*, response*/  } = await GET('/path/to/endpoint');
```

For more information, see the [openapi-fetch documentation](https://openapi-ts.pages.dev/openapi-fetch/).

## Credits

Big thanks to [@drwpow](https://github.com/drwpow) for creating the original openapi-fetch and openapi-typescript library!
