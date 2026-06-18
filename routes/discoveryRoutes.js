import {
  getAllIdentities
} from "../repositories/identityRepository.js";

import {
  buildPopulationArchive
} from "../src/services/populationArchiveBuilderService.js";

import {
  discoverPopulationPatterns
} from "../src/services/populationDiscoveryService.js";

export async function discoveryRoutes(
  fastify
) {

  fastify.get(
    "/v1/discoveries",
    async () => {

const identities =
  getAllIdentities();

const archives =
  buildPopulationArchive(
    identities.map(
      identity =>
        identity.id
    )
  );


return {
  discoveries:
    discoverPopulationPatterns(
      archives
    )
};

    }
  );
}
