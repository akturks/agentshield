export class EvidenceRepository {

  constructor() {

    //
    // Event Store
    //

    this.eventStore =
      new Map();

    //
    // Evidence Store
    //

    this.evidenceStore =
      new Map();
  }

  saveEvidence(evidence) {

    this.evidenceStore.set(
      evidence.evidenceId,
      evidence
    );

    if (
      !this.eventStore.has(
        evidence.evidenceId
      )
    ) {
      this.eventStore.set(
        evidence.evidenceId,
        []
      );
    }
  }


appendEvent(
  evidenceId,
  event
) {

  if (
    !this.eventStore.has(
      evidenceId
    )
  ) {
    throw new Error(
      "Evidence not found"
    );
  }

  this.eventStore
    .get(evidenceId)
    .push(event);

  const evidence =
    this.evidenceStore.get(
      evidenceId
    );

  evidence.applyEvent(
    event
  );
}

  getEvents(
    evidenceId
  ) {

    return (
      this.eventStore.get(
        evidenceId
      ) || []
    );
  }

  getEvidence(
    evidenceId
  ) {

    return this.evidenceStore.get(
      evidenceId
    );
  }


reconstructEvidence(
  evidenceId
) {

  const evidence =
    this.evidenceStore.get(
      evidenceId
    );

  if (!evidence) {
    throw new Error(
      "Evidence not found"
    );
  }

  const events =
    this.getEvents(
      evidenceId
    );

  evidence.replay(events);

  return evidence;
 }

}
