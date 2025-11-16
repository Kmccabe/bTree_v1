export enum SubjectOuterState {
  Registered = 0,
  Waiting = 1,
  Matched = 2,
  InGame = 3,
  Finished = 4,
  Dropped = 5,
}

export enum SubjectRole {
  None = 0,
  S1 = 1,
  S2 = 2,
}

export enum InnerStateS1 {
  None = 0,
  Quiz = 1,
  Decision = 2,
  WaitingForS2 = 3,
  Result = 4,
}

export enum InnerStateS2 {
  None = 0,
  Decision = 1,
  Result = 2,
}

export enum GameStatus {
  Empty = 0,
  S1AndS2Assigned = 1,
  S1Committed = 2,
  S1Decided = 3,
  S2Decided = 4,
  Paid = 5,
  Expired = 6,
}

export enum TreatmentTiming {
  Synchronous = 0,
  Asynchronous = 1,
}

export interface SubjectParticipation {
  subjectId: string;
  experimentId: string;
  wallet: string;
  outerState: SubjectOuterState;
  role: SubjectRole;
  gameId: string | null;
  innerStateS1: InnerStateS1;
  innerStateS2: InnerStateS2;
  treatmentTiming: TreatmentTiming;
  payoff: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameInstance {
  gameId: string;
  experimentId: string;
  status: GameStatus;
  treatmentTiming: TreatmentTiming;
  s1SubjectId: string | null;
  s2SubjectId: string | null;
  s1Wallet: string | null;
  s2Wallet: string | null;
  X: number | null;
  R: number | null;
  payoffS1: number | null;
  payoffS2: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdRound?: number;
  resolvedRound?: number;
  expiryRound?: number;
}

type SubjectParticipationKey = string;
type GameInstanceKey = string;

function makeSubjectKey(experimentId: string, subjectId: string): SubjectParticipationKey {
  return `${experimentId}:${subjectId}`;
}

export class SessionManager {
  private subjects: Map<SubjectParticipationKey, SubjectParticipation>;
  private games: Map<GameInstanceKey, GameInstance>;
  private nextGameId: number;

  constructor() {
    this.subjects = new Map();
    this.games = new Map();
    this.nextGameId = 1;
  }

  private allocateGameId(): string {
    const gameId = `game-${this.nextGameId}`;
    this.nextGameId += 1;
    return gameId;
  }

  private getWaitingSubjectsForExperiment(
    experimentId: string,
    treatmentTiming: TreatmentTiming,
  ): SubjectParticipation[] {
    const waiting: SubjectParticipation[] = [];
    for (const participation of this.subjects.values()) {
      if (
        participation.experimentId !== experimentId ||
        participation.treatmentTiming !== treatmentTiming ||
        participation.gameId !== null ||
        participation.outerState !== SubjectOuterState.Waiting
      ) {
        continue;
      }
      waiting.push(participation);
    }

    return waiting.sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.subjectId.localeCompare(b.subjectId);
    });
  }

  public upsertSubjectParticipation(params: {
    experimentId: string;
    subjectId: string;
    wallet: string;
    treatmentTiming: TreatmentTiming;
  }): SubjectParticipation {
    const key = makeSubjectKey(params.experimentId, params.subjectId);
    const existing = this.subjects.get(key);

    if (existing) {
      existing.wallet = params.wallet;
      existing.updatedAt = new Date();
      return existing;
    }

    const timestamp = new Date();
    const created: SubjectParticipation = {
      subjectId: params.subjectId,
      experimentId: params.experimentId,
      wallet: params.wallet,
      outerState: SubjectOuterState.Waiting,
      role: SubjectRole.None,
      gameId: null,
      innerStateS1: InnerStateS1.None,
      innerStateS2: InnerStateS2.None,
      treatmentTiming: params.treatmentTiming,
      payoff: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.subjects.set(key, created);
    return created;
  }

  public getSubjectParticipation(experimentId: string, subjectId: string): SubjectParticipation | undefined {
    const key = makeSubjectKey(experimentId, subjectId);
    return this.subjects.get(key);
  }

  public listSubjects(params: {
    experimentId: string;
    outerState?: SubjectOuterState;
  }): SubjectParticipation[] {
    const results: SubjectParticipation[] = [];
    for (const subject of this.subjects.values()) {
      if (subject.experimentId !== params.experimentId) {
        continue;
      }
      if (params.outerState !== undefined && subject.outerState !== params.outerState) {
        continue;
      }
      results.push(subject);
    }
    return results;
  }

  public matchNextPair(params: {
    experimentId: string;
    treatmentTiming: TreatmentTiming;
    E1?: number;
    E2?: number;
    m?: number;
    s?: number;
  }): GameInstance | null {
    const waiting = this.getWaitingSubjectsForExperiment(params.experimentId, params.treatmentTiming);
    if (waiting.length < 2) {
      return null;
    }

    const [s1, s2] = waiting;
    const gameId = this.allocateGameId();
    const timestamp = new Date();

    const game: GameInstance = {
      gameId,
      experimentId: params.experimentId,
      status: GameStatus.S1AndS2Assigned,
      treatmentTiming: params.treatmentTiming,
      s1SubjectId: s1.subjectId,
      s2SubjectId: s2.subjectId,
      s1Wallet: s1.wallet,
      s2Wallet: s2.wallet,
      X: null,
      R: null,
      payoffS1: null,
      payoffS2: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const gameKey: GameInstanceKey = gameId;
    this.games.set(gameKey, game);

    s1.role = SubjectRole.S1;
    s1.outerState = SubjectOuterState.InGame;
    s1.gameId = gameId;
    s1.innerStateS1 = InnerStateS1.Decision;
    s1.updatedAt = timestamp;
    this.subjects.set(makeSubjectKey(s1.experimentId, s1.subjectId), s1);

    s2.role = SubjectRole.S2;
    s2.outerState = SubjectOuterState.InGame;
    s2.gameId = gameId;
    s2.innerStateS2 = InnerStateS2.None;
    s2.updatedAt = timestamp;
    this.subjects.set(makeSubjectKey(s2.experimentId, s2.subjectId), s2);

    return game;
  }

  public createGameInstance(params: {
    experimentId: string;
    treatmentTiming: TreatmentTiming;
  }): GameInstance {
    throw new Error("Not implemented (Step 1)");
  }

  public getGameInstance(experimentId: string, gameId: string): GameInstance | undefined {
    throw new Error("Not implemented (Step 1)");
  }

  public listGameInstances(params: {
    experimentId: string;
  }): GameInstance[] {
    throw new Error("Not implemented (Step 1)");
  }

  public getGame(gameId: string): GameInstance | undefined {
    for (const game of this.games.values()) {
      if (game.gameId === gameId) {
        return game;
      }
    }
    return undefined;
  }

  public listGames(experimentId: string): GameInstance[] {
    const result: GameInstance[] = [];
    for (const game of this.games.values()) {
      if (game.experimentId === experimentId) {
        result.push(game);
      }
    }
    return result;
  }
}

export const sessionManager = new SessionManager();
