import {
  getIdentityById
} from "../repositories/identityRepository.js";

import {
  getEventsByIdentity
} from "../repositories/eventRepository.js";

import {
  getAssessmentsByIdentity
} from "../repositories/assessmentRepository.js";

import {
  getOutcomesByIdentity
} from "../repositories/outcomeRepository.js";

import {
  getMemoriesByIdentity
} from "../repositories/memoryRepository.js";

import {
  getBehaviorHistory
} from "../repositories/behaviorHistoryRepository.js";

import {
  discoverPatterns
} from "../src/services/patternDiscoveryService.js";

import {
  characterizePatterns
} from "../src/services/characterizationService.js";

import {
  generateBehaviorObservations
} from "../src/services/observationGenerationService.js";

import {
  discoverBehavior
} from "../src/services/discoveryService.js";

export async function archiveRoutes(
  fastify
) {
  fastify.get(
    "/v1/archive/identity/:identityId",
    async request => {

      const {
        identityId
      } = request.params;

const history =
  getBehaviorHistory(
    identityId
  );

const patterns =
  discoverPatterns(
    history
  );

const characterization =
  characterizePatterns(
    patterns
  );

const observations =
  generateBehaviorObservations({
    history,
    patterns,
    characterization,

    memories:
      getMemoriesByIdentity(
        identityId
      )
  });

const discoveries =
  discoverBehavior({
    patterns,
    characterization
  });

return {
  identity:
    getIdentityById(
      identityId
    ),

  events:
    getEventsByIdentity(
      identityId
    ),

  assessments:
    getAssessmentsByIdentity(
      identityId
    ),

  outcomes:
    getOutcomesByIdentity(
      identityId
    ),

  memories:
    getMemoriesByIdentity(
      identityId
    ),

  history,

  patterns,

  characterization,

observations,

discoveries

};

    }
  );
}
