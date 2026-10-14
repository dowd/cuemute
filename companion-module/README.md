# Companion module for cuemute

A [Bitfocus Companion](https://bitfocus.io/companion) module that runs cuemute from a Stream Deck. It needs Companion 5.0 or later. What the module does is in [companion/HELP.md](companion/HELP.md).

## Install it in Companion

1. Build the package:

   ```sh
   cd companion-module
   npm install
   npm run package
   ```

   This makes `cuemute-<version>.tgz`.

2. In Companion, open **Modules**.
3. Select **Import module package** and choose `cuemute-<version>.tgz`.
4. Open **Connections** and add a **cuemute** connection.
5. Set the address and port of cuemute.

After a change to the module, build the package again and import it again.

## Develop

To load the module from source instead, set Companion's developer modules path to a folder that holds this one, then run `npm run dev`. Companion reloads the module when `dist/` changes.

```sh
npm test           # logic tests
npm run typecheck
npx companion-module-check
```
