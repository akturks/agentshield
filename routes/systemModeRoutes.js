import {
  getSystemMode,
  setSystemMode
} from "../repositories/systemRepository.js";

export default async function (
  app
) {

  app.get(
    "/v1/system-mode",
    async () => {

      const mode =
        getSystemMode(
          "tenant_1"
        );

      return mode;
    }
  );

  app.post(
    "/v1/system-mode",
    async (request) => {

      const mode =
        setSystemMode(
          "tenant_1",
          request.body.mode
        );

      return mode;
    }
  );
}
