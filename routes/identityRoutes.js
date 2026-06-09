import {
  getAssessmentsByIdentity,
  getIdentityProfile,
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

export default async function (
  app,
  {
    classify,
    evaluatePolicy,
    allocate,
    enforce,
    evaluateOutcome,
    generateFeedback,
    evaluateLearning,
    applyTrustUpdate
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

      const outcome =
        evaluateOutcome(
          enforcement
        );

      const feedback =
        generateFeedback(
          outcome
        );

      const learning =
        evaluateLearning(
          outcome
        );

      const trustUpdate =
        applyTrustUpdate(
          profile.currentTrustScore,
          feedback
        );

      return {
        ...profile,
        risk,
        policy,
        allocation,
        enforcement,
        outcome,
        feedback,
        learning,
        trustUpdate
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
