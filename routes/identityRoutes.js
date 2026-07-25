import {
  getAssessmentsByIdentity,
  getIdentityProfile,
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

import {
  getBehaviorProfile
} from "../repositories/behaviorProfileRepository.js";

import {
  getBehaviorHistory
} from "../repositories/behaviorHistoryRepository.js";

export default async function (
  app,
  {
    classify,
    evaluatePolicy,
    allocate,
    enforce
  }
) {

  app.get(
    "/v1/identities/:identityId/assessments",
    async (request) => {

      const assessments =
        getAssessmentsByIdentity(
          request.params.identityId
        );

      return {
        identityId:
          request.params.identityId,

        assessments
      };
    }
  );

  app.get(
    "/v1/identities/:identityId/profile",
    async (request, reply) => {

      const profile =
        getIdentityProfile(
          request.params.identityId
        );

      if (!profile) {
        return reply
          .status(404)
          .send({
            error:
              "identity_not_found"
          });
      }

      const behaviorProfile =
        getBehaviorProfile(
          request.params.identityId
        );

      const risk =
        classify(profile);

      const policy =
        evaluatePolicy(risk);

      const allocation =
        allocate(risk);

      const enforcement =
        enforce(
          policy,
          allocation
        );

      return {
        ...profile,
        behaviorProfile,
        risk,
        policy,
        allocation,
        enforcement
      };
    }
  );

  app.get(
    "/v1/identities",
    async () => {

      const identities =
        getAllIdentityProfiles();

      return {
        identities
      };
    }
  );

  app.get(
    "/v1/identities/:identityId/history",
    async (request, reply) => {

      const history =
        getBehaviorHistory(
          request.params.identityId
        );

      if (!history) {
        return reply
          .status(404)
          .send({
            error:
              "identity_not_found"
          });
      }

      return history;
    }
  );

  app.get(
    "/v1/identities/high-risk",
    async () => {

      const identities =
        getAllIdentityProfiles();

      const highRiskIdentities =
        identities
          .map(profile => ({
            ...profile,
            risk:
              classify(profile)
          }))
          .filter(
            identity =>
              identity.risk.riskLevel === "high" ||
              identity.risk.riskLevel === "critical"
          )
          .sort(
            (a, b) =>
              b.risk.riskScore -
              a.risk.riskScore
          );

      return {
        identities:
          highRiskIdentities
      };
    }
  );
}
