export class PerformanceMetrics {
  constructor() {
    this.resetSession();
  }

  resetSession() {
    this.metrics = {
      searchTime: 0,
      guidanceTime: 0,
      totalTime: 0,
      undesiredObjects: 0,
      accuracy: 0,
      successfulRetrievals: 0,
      totalDetectedObjects: 0,
    };
    this.sessionState = {
      searchStartTime: 0,
      guidanceStartTime: 0,
      isSearching: false,
      isGuiding: false,
      currentPrompt: "",
    };
  }

  startSearch(prompt) {
    if (this.sessionState.currentPrompt !== prompt) {
      this.sessionState.currentPrompt = prompt;
      this.sessionState.searchStartTime = performance.now();
      this.sessionState.isSearching = true;
      this.sessionState.isGuiding = false;
    } else if (!this.sessionState.isSearching && !this.sessionState.isGuiding) {
      // Resume search or start if not active
      this.sessionState.searchStartTime = performance.now();
      this.sessionState.isSearching = true;
    }
  }

  objectDetected() {
    if (this.sessionState.isSearching) {
      // Reset metrics only when a new object is actually found
      this.metrics.guidanceTime = 0;
      this.metrics.totalTime = 0;

      const now = performance.now();
      // "End: Bounding Box drawn" -> Search Time end.
      const searchDuration = (now - this.sessionState.searchStartTime) / 1000;
      this.metrics.searchTime = searchDuration;

      this.sessionState.isSearching = false;
      this.sessionState.isGuiding = true;
      this.sessionState.guidanceStartTime = now;

      this.metrics.totalDetectedObjects++;
    }
  }

  guidanceAborted() {
    if (this.sessionState.isGuiding) {
      this.sessionState.isGuiding = false;
      this.metrics.undesiredObjects++;
      this.sessionState.isSearching = true;
      this.sessionState.searchStartTime = performance.now();
    }
  }

  guidanceCompleted() {
    if (this.sessionState.isGuiding) {
      const now = performance.now();
      // "End: sensor ist auf stufe 5"
      const guidanceDuration =
        (now - this.sessionState.guidanceStartTime) / 1000;
      this.metrics.guidanceTime = guidanceDuration;
      this.metrics.totalTime =
        this.metrics.searchTime + this.metrics.guidanceTime;

      this.sessionState.isGuiding = false;
      this.metrics.successfulRetrievals++;
    }
  }

  getMetricsDisplay() {
    // Return an HTML string or object
    const accuracyPct =
      this.metrics.totalDetectedObjects > 0
        ? (
            (this.metrics.successfulRetrievals /
              this.metrics.totalDetectedObjects) *
            100
          ).toFixed(1)
        : 0;

    return `
      <div style="font-size: 0.8em; line-height: 1.2;">
        <div>Search Time: ${this.metrics.searchTime.toFixed(2)}s</div>
        <div>Guidance Time: ${this.metrics.guidanceTime.toFixed(2)}s</div>
        <div>Total Time: ${this.metrics.totalTime.toFixed(2)}s</div>
        <div>Undesired: ${this.metrics.undesiredObjects}</div>
        <div>Accuracy: ${accuracyPct}</div>
      </div>
    `;
  }
}
