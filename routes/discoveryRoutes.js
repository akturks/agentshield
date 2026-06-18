import {
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

import {
  discoverPopulationPatterns
} from "../src/services/populationDiscoveryService.js";

export async function discoveryRoutes(
  fastify
) {

  fastify.get(
    "/v1/discoveries",
    async () => {

      const profiles =
        getAllIdentityProfiles();

      const archives =
        profiles.map(
          profile => ({
            characterization: {
              character:
                profile.character ||
                "Unknown"
            }
          })
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
