import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import type {
  ParsedWorkoutCollection,
  ParsedWorkout,
  ParsedWorkoutExercise,
  RecommendationDraft,
} from "@/lib/ai-types";
import {
  generateNextWorkout,
  getAiContext,
  importNote,
  parseNoteDirect,
  refineWorkout,
  saveParsedWorkout,
} from "@/lib/ai-api";

const defaultNote =
  "back squat 3x8 @90kg felt heavy\nbench 4x6 @75kg\nbarbell row 4x10\ncable curls sets tbd";

const defaultRefineMessage =
  "Make the next workout shorter, more machine-based, and easier on the lower back.";

const defaultConstraints = {
  availableMinutes: 45,
};

type LoadingAction =
  | "bootstrap"
  | "import"
  | "parse-direct"
  | "save"
  | "generate"
  | "refine"
  | null;

type SessionTag =
  | "Jambes"
  | "Dos"
  | "Pec"
  | "Push"
  | "Pull"
  | "Upper"
  | "Lower"
  | "Bras"
  | "Epaules";

type EditableSession = ParsedWorkout & {
  id: string;
  sequenceIndex: number;
  weekLabel: string;
  sessionTag: SessionTag;
};

const sessionTagOptions: SessionTag[] = [
  "Jambes",
  "Dos",
  "Pec",
  "Push",
  "Pull",
  "Upper",
  "Lower",
  "Bras",
  "Epaules",
];

export default function ImportNoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ note?: string | string[] }>();
  const [rawNote, setRawNote] = useState(defaultNote);
  const [noteImportSummary, setNoteImportSummary] = useState<string | null>(null);
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [directParseCollection, setDirectParseCollection] = useState<ParsedWorkoutCollection | null>(null);
  const [editableSessions, setEditableSessions] = useState<EditableSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationDraft | null>(null);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [latestWorkoutId, setLatestWorkoutId] = useState<string | null>(null);
  const [refineMessage, setRefineMessage] = useState(defaultRefineMessage);
  const [userProfile, setUserProfile] = useState<unknown>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoImportStatus, setAutoImportStatus] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>("bootstrap");
  const lastAutoRunRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const result = await getAiContext();
        if (cancelled) return;

        setUserProfile(
          result.user
            ? {
                goal: result.user.goal ?? "muscle_gain",
                level: result.user.level ?? "intermediate",
                frequencyPerWeek: result.user.frequencyPerWeek ?? 4,
                sessionDuration: result.user.sessionDuration ?? 45,
                equipment: Array.isArray(result.user.equipment) ? result.user.equipment : [],
                splitPreference: result.user.splitPreference ?? "upper_lower",
              }
            : null,
        );
        setRecentWorkouts(result.recentWorkouts);
        setLatestWorkoutId(result.latestWorkoutId);

        if (result.latestRecommendation) {
          setRecommendation(result.latestRecommendation);
        }
        setRecommendationId(result.latestRecommendationId);
        setThreadId(result.latestThreadId);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load context");
        }
      } finally {
        if (!cancelled) {
          setLoadingAction(null);
        }
      }
    }

    loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSession = editableSessions.find((session) => session.id === activeSessionId) ?? null;

  function hydrateEditableSessions(collection: ParsedWorkoutCollection) {
    const sessions = collection.sessions.map((session, index) => ({
      ...session,
      id: `session-${index + 1}`,
      sequenceIndex: index,
      weekLabel: inferWeekLabel(session.title, index),
      sessionTag: inferSessionTag(session),
    }));

    setEditableSessions(sessions);
    setActiveSessionId(null);
  }

  function resetDownstreamFlow() {
    setParsedWorkout(null);
    setDirectParseCollection(null);
    setEditableSessions([]);
    setActiveSessionId(null);
    setRecommendation(null);
    setRecommendationId(null);
    setThreadId(null);
    setRefinementSummary("");
  }

  const runAutoImport = useCallback(async (nextNote: string, source: "APPLE_NOTES_SHARE" | "MANUAL_PASTE") => {
    const trimmedNote = nextNote.trim();
    if (!trimmedNote) {
      return;
    }

    setError(null);
    resetDownstreamFlow();
    setAutoImportStatus("Detecting workouts in the note...");
    setLoadingAction("import");
    try {
      const importResult = await importNote({
        rawText: trimmedNote,
        source,
      });

      setNoteImportSummary(importResult.summary ?? null);
      setAutoImportStatus("Parsing the full note into editable sessions...");
      setLoadingAction("parse-direct");

      const parsedResult = await parseNoteDirect(trimmedNote);
      setDirectParseCollection(parsedResult.parsedCollection);
      hydrateEditableSessions(parsedResult.parsedCollection);
      lastAutoRunRef.current = trimmedNote;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to import note");
    } finally {
      setAutoImportStatus(null);
      setLoadingAction(null);
    }
  }, []);

  useEffect(() => {
    const sharedNote = Array.isArray(params.note) ? params.note[0] : params.note;
    if (typeof sharedNote === "string" && sharedNote.trim() && sharedNote !== rawNote) {
      setRawNote(sharedNote);
      lastAutoRunRef.current = null;
    }
  }, [params.note, rawNote]);

  useEffect(() => {
    const trimmedNote = rawNote.trim();
    if (!trimmedNote || loadingAction === "bootstrap" || trimmedNote === lastAutoRunRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      const sharedNote = Array.isArray(params.note) ? params.note[0] : params.note;
      const source =
        typeof sharedNote === "string" && sharedNote.trim() ? "APPLE_NOTES_SHARE" : "MANUAL_PASTE";
      void runAutoImport(trimmedNote, source);
    }, 700);

    return () => clearTimeout(timeout);
  }, [loadingAction, params.note, rawNote, runAutoImport]);

  async function handleSaveWorkout() {
    const workoutToSave = activeSession ?? parsedWorkout;
    if (!workoutToSave) {
      setError("Parse the note before saving the workout.");
      return;
    }

    setError(null);
    setLoadingAction("save");
    try {
      const result = await saveParsedWorkout({
        rawText: activeSession ? buildSessionRawText(activeSession) : rawNote,
        parsedWorkout: workoutToSave,
      });
      setLatestWorkoutId(result.workoutId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save workout");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGenerateNextWorkout() {
    setError(null);
    setLoadingAction("generate");
    try {
      const result = await generateNextWorkout({
        userProfile,
        recentWorkouts,
        latestWorkout: parsedWorkout,
        constraints: defaultConstraints,
        basedOnWorkoutId: latestWorkoutId ?? undefined,
      });

      setRecommendation(result.recommendation);
      setRecommendationId(result.recommendationId);
      setThreadId(result.threadId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to generate next workout");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRefineWorkout() {
    if (!recommendation || !recommendationId) {
      setError("Generate the next workout before refining it.");
      return;
    }

    setError(null);
    setLoadingAction("refine");
    try {
      const result = await refineWorkout({
        currentRecommendation: recommendation,
        recommendationId,
        threadId: threadId ?? undefined,
        userMessage: refineMessage,
        recentWorkouts,
      });

      setRecommendation(result.refinement.recommendation);
      setRefinementSummary(result.refinement.message);
      setRecommendationId(result.recommendationId);
      setThreadId(result.threadId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to refine workout");
    } finally {
      setLoadingAction(null);
    }
  }

  const [refinementSummary, setRefinementSummary] = useState("");

  const isBusy = loadingAction !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.backTap, pressed && styles.pressed]}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.title}>Import from Notes</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.sectionTitle}>1. Paste or share the full note</Text>
          <Text style={styles.sectionBody}>
            Use this flow for a full Apple Note with multiple sessions. As soon as text arrives
            here, the app detects the sessions and builds the editable import automatically.
          </Text>

          <TextInput
            multiline
            value={rawNote}
            onChangeText={setRawNote}
            style={styles.inputBox}
            placeholder="squat 3x8 @90kg..."
            placeholderTextColor="#9ea3ac"
          />

          {loadingAction === "import" || loadingAction === "parse-direct" ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#171a20" />
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>Importing note</Text>
                <Text style={styles.summaryBody}>
                  {autoImportStatus ?? "Preparing the editable sessions from the shared note."}
                </Text>
              </View>
            </View>
          ) : null}

          {noteImportSummary ? (
            <>
              <Text style={styles.resultLabel}>Detected sessions</Text>
              <View style={styles.resultCard}>
                <Text style={styles.summaryBody}>{noteImportSummary}</Text>
              </View>
            </>
          ) : null}

          {directParseCollection ? (
            <>
              <Text style={styles.resultLabel}>Detected sessions editor</Text>
              <View style={styles.resultCard}>
                {directParseCollection.summary ? <Text style={styles.summaryBody}>{directParseCollection.summary}</Text> : null}
                <DraggableFlatList
                  data={editableSessions}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  activationDistance={8}
                  containerStyle={styles.draggableList}
                  contentContainerStyle={styles.draggableContent}
                  onDragEnd={({ data }) => {
                    const resequenced = data.map((session, index) => ({
                      ...session,
                      sequenceIndex: index,
                    }));
                    setEditableSessions(resequenced);
                    if (activeSessionId) {
                      const active = resequenced.find((session) => session.id === activeSessionId) ?? null;
                      setParsedWorkout(active ? toParsedWorkout(active) : null);
                    }
                  }}
                  renderItem={({ item, drag, isActive }) => (
                    <ScaleDecorator>
                      <EditableSessionCard
                        session={item}
                        selected={item.id === activeSessionId}
                        isDragging={isActive}
                        onSelect={() => {
                          setActiveSessionId(item.id);
                          setParsedWorkout(toParsedWorkout(item));
                        }}
                        onDoneEditing={() => setActiveSessionId(null)}
                        onSaveSession={handleSaveWorkout}
                        onStartDrag={drag}
                        onTagChange={(tag) =>
                          updateSession(item.id, { sessionTag: tag, title: tag }, setEditableSessions, activeSessionId, setParsedWorkout)
                        }
                        onWeekChange={(weekLabel) =>
                          updateSession(item.id, { weekLabel }, setEditableSessions, activeSessionId, setParsedWorkout)
                        }
                        onExerciseAdjust={(exerciseIndex, patch) =>
                          adjustExercise(item.id, exerciseIndex, patch, setEditableSessions, activeSessionId, setParsedWorkout)
                        }
                      />
                    </ScaleDecorator>
                  )}
                />
              </View>
            </>
          ) : null}

          {activeSession || parsedWorkout ? (
            <>
              <Text style={styles.resultLabel}>Parsed workout</Text>
              <ParsedWorkoutCard workout={activeSession ? toParsedWorkout(activeSession) : parsedWorkout!} />
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || loadingAction === "save") && styles.pressed,
                ]}
                onPress={handleSaveWorkout}
                disabled={isBusy}
              >
                {loadingAction === "save" ? (
                  <ActivityIndicator color="#171a20" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Save session</Text>
                )}
              </Pressable>
            </>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>2. Generate the next workout</Text>
          <Text style={styles.sectionBody}>
            Uses the signed-in profile and recent workout history already stored in the app.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || loadingAction === "generate") && styles.pressed,
            ]}
            onPress={handleGenerateNextWorkout}
            disabled={isBusy}
          >
            {loadingAction === "generate" ? (
              <ActivityIndicator color="#f4f6f9" />
            ) : (
              <Text style={styles.primaryButtonText}>Generate next workout</Text>
            )}
          </Pressable>

          {recommendation ? (
            <>
              <Text style={styles.resultLabel}>Next workout</Text>
              <RecommendationCard recommendation={recommendation} />
            </>
          ) : null}

          {recommendation ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>3. Refine with the coach</Text>
              <Text style={styles.sectionBody}>
                Ask for less volume, different equipment, more focus on a muscle group, or shorter duration.
              </Text>

              <TextInput
                multiline
                value={refineMessage}
                onChangeText={setRefineMessage}
                style={styles.inputBox}
                placeholder="Make it shorter..."
                placeholderTextColor="#9ea3ac"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || loadingAction === "refine") && styles.pressed,
                ]}
                onPress={handleRefineWorkout}
                disabled={isBusy}
              >
                {loadingAction === "refine" ? (
                  <ActivityIndicator color="#171a20" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Refine workout</Text>
                )}
              </Pressable>

              {refinementSummary ? <Text style={styles.coachSummary}>{refinementSummary}</Text> : null}
            </>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EditableSessionCard({
  session,
  selected,
  isDragging,
  onSelect,
  onDoneEditing,
  onSaveSession,
  onStartDrag,
  onTagChange,
  onWeekChange,
  onExerciseAdjust,
}: {
  session: EditableSession;
  selected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDoneEditing: () => void;
  onSaveSession: () => void;
  onStartDrag: () => void;
  onTagChange: (tag: SessionTag) => void;
  onWeekChange: (weekLabel: string) => void;
  onExerciseAdjust: (
    exerciseIndex: number,
    patch: Partial<ParsedWorkoutExercise>,
  ) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.directSessionCard,
        selected && styles.directSessionCardSelected,
        isDragging && styles.directSessionCardDragging,
        pressed && styles.pressed,
      ]}
      onPress={!selected ? onSelect : undefined}
    >
      <View style={styles.summaryHeader}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryEyebrow}>Detected session {session.sequenceIndex + 1}</Text>
          <Text style={styles.summaryTitle}>{session.title ?? `Session ${session.sequenceIndex + 1}`}</Text>
          <Text style={styles.summaryBody}>{buildSessionSummary(session)}</Text>
        </View>
        <View style={styles.sessionActions}>
          <Pressable style={styles.gripPill} onLongPress={onStartDrag} delayLongPress={120}>
            <MaterialCommunityIcons name="drag-vertical" size={16} color="#f7f7f7" />
          </Pressable>
        </View>
      </View>

      <View style={styles.metaRow}>
        <MetaChip label={session.sessionTag} />
        <MetaChip label={session.weekLabel} tone="soft" />
        {session.performedAt ? <MetaChip label={formatPerformedAt(session.performedAt)} tone="soft" /> : null}
        {!selected ? (
          <Pressable style={styles.inlineEditChip} onPress={onSelect}>
            <Text style={styles.inlineEditChipText}>Modify</Text>
          </Pressable>
        ) : null}
      </View>

      {selected ? (
        <>
          <View style={styles.chipPickerRow}>
            {sessionTagOptions.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.pickerChip, session.sessionTag === tag && styles.pickerChipActive]}
                onPress={() => onTagChange(tag)}
              >
                <Text style={[styles.pickerChipText, session.sessionTag === tag && styles.pickerChipTextActive]}>{tag}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.weekRow}>
            <Text style={styles.fieldLabel}>Week</Text>
            <TextInput
              value={session.weekLabel}
              onChangeText={onWeekChange}
              style={styles.weekInput}
              placeholder="Semaine 1"
              placeholderTextColor="#9ea3ac"
            />
          </View>

          <View style={styles.exerciseList}>
            {session.exercises.map((exercise, index) => (
              <EditableExerciseRow
                key={`${session.id}-${exercise.order}-${exercise.name}`}
                exercise={exercise}
                onAdjust={(patch) => onExerciseAdjust(index, patch)}
              />
            ))}
          </View>

          <View style={styles.editorActions}>
            <Pressable style={styles.editorGhostButton} onPress={onDoneEditing}>
              <Text style={styles.editorGhostButtonText}>Done editing</Text>
            </Pressable>
            <Pressable style={styles.editorPrimaryButton} onPress={onSaveSession}>
              <Text style={styles.editorPrimaryButtonText}>Save this session</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.sessionPreviewList}>
          {session.exercises.slice(0, 4).map((exercise) => (
            <View key={`${session.id}-${exercise.order}-${exercise.name}`} style={styles.sessionPreviewCard}>
              <Text style={styles.sessionPreviewName}>{exercise.name}</Text>
              <Text style={styles.sessionPreviewDetail}>{formatWorkoutVolume(exercise)}</Text>
            </View>
          ))}
          {session.exercises.length > 4 ? (
            <Text style={styles.sessionPreviewMore}>+{session.exercises.length - 4} more exercises</Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function EditableExerciseRow({
  exercise,
  onAdjust,
}: {
  exercise: ParsedWorkoutExercise;
  onAdjust: (patch: Partial<ParsedWorkoutExercise>) => void;
}) {
  return (
    <View style={styles.editExerciseCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryCopy}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {exercise.notes ? <Text style={styles.exerciseNote}>{exercise.notes}</Text> : null}
        </View>
        {typeof exercise.confidence === "number" ? (
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{Math.round(exercise.confidence * 100)}%</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metricGrid}>
        <Stepper label="Sets" value={exercise.sets ?? 0} step={1} onChange={(value) => onAdjust({ sets: value })} />
        <Stepper label="Reps" value={exercise.reps ?? exercise.repMin ?? 0} step={1} onChange={(value) => onAdjust({ reps: value, repMin: value, repMax: value })} />
        <Stepper label="Weight" value={exercise.weight ?? 0} step={2.5} onChange={(value) => onAdjust({ weight: value })} />
        <Stepper label="Rest" value={exercise.restSeconds ?? 0} step={15} suffix="s" onChange={(value) => onAdjust({ restSeconds: value })} />
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable style={styles.iconButton} onPress={() => onChange(Math.max(0, roundStep(value - step)))}>
          <Text style={styles.iconButtonText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>
          {formatNumeric(value)}
          {suffix}
        </Text>
        <Pressable style={styles.iconButton} onPress={() => onChange(roundStep(value + step))}>
          <Text style={styles.iconButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ParsedWorkoutCard({ workout }: { workout: ParsedWorkout }) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryEyebrow}>Session parsed</Text>
          <Text style={styles.summaryTitle}>{workout.title ?? "Workout session"}</Text>
          <Text style={styles.summaryBody}>
            {workout.cleanedSummary ?? "Review the extracted session before saving it."}
          </Text>
        </View>
        <View style={styles.metaBadge}>
          <Text style={styles.metaBadgeValue}>{workout.exercises.length}</Text>
          <Text style={styles.metaBadgeLabel}>exercises</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {workout.sessionType ? <MetaChip label={workout.sessionType.replaceAll("_", " ")} /> : null}
        {workout.performedAt ? <MetaChip label={formatPerformedAt(workout.performedAt)} /> : null}
        {workout.fatigueNote ? <MetaChip label={workout.fatigueNote} tone="soft" /> : null}
      </View>

      <View style={styles.exerciseList}>
        {workout.exercises.map((exercise) => (
          <ParsedExerciseRow key={`${exercise.order}-${exercise.name}`} exercise={exercise} />
        ))}
      </View>
    </View>
  );
}

function RecommendationCard({ recommendation }: { recommendation: RecommendationDraft }) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryEyebrow}>Recommended next</Text>
          <Text style={styles.summaryTitle}>{recommendation.title}</Text>
          <Text style={styles.summaryBody}>
            {recommendation.coachSummary ??
              recommendation.explanation ??
              "A structured next session based on your recent training."}
          </Text>
        </View>
        <View style={styles.metaBadge}>
          <Text style={styles.metaBadgeValue}>{recommendation.exercises.length}</Text>
          <Text style={styles.metaBadgeLabel}>blocks</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {recommendation.goal ? <MetaChip label={recommendation.goal.replaceAll("_", " ")} /> : null}
        {recommendation.estimatedDurationMinutes ? (
          <MetaChip label={`${recommendation.estimatedDurationMinutes} min`} tone="soft" />
        ) : null}
      </View>

      <View style={styles.exerciseList}>
        {recommendation.exercises.map((exercise) => (
          <RecommendationExerciseRow key={`${exercise.order}-${exercise.name}`} exercise={exercise} />
        ))}
      </View>
    </View>
  );
}

function ParsedExerciseRow({ exercise }: { exercise: ParsedWorkoutExercise }) {
  const volume = formatWorkoutVolume(exercise);
  const load = formatLoad(exercise.weight, exercise.unit);
  const detail = [load, formatRest(exercise.restSeconds)].filter(Boolean).join(" · ");

  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseMain}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseVolume}>{volume}</Text>
        {detail ? <Text style={styles.exerciseDetail}>{detail}</Text> : null}
        {exercise.notes ? <Text style={styles.exerciseNote}>{exercise.notes}</Text> : null}
      </View>
      {typeof exercise.confidence === "number" ? (
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>{Math.round(exercise.confidence * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

function RecommendationExerciseRow({
  exercise,
}: {
  exercise: RecommendationDraft["exercises"][number];
}) {
  const volume = `${exercise.sets} x ${formatRepRange(exercise.repMin, exercise.repMax)}`;
  const detailParts = [
    formatRest(exercise.restSeconds),
    typeof exercise.targetRpe === "number" ? `RPE ${exercise.targetRpe}` : null,
    typeof exercise.rir === "number" ? `${exercise.rir} RIR` : null,
  ].filter(Boolean);

  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseMain}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseVolume}>{volume}</Text>
        {detailParts.length ? <Text style={styles.exerciseDetail}>{detailParts.join(" · ")}</Text> : null}
        {exercise.notes ? <Text style={styles.exerciseNote}>{exercise.notes}</Text> : null}
        {exercise.substitutions?.length ? (
          <Text style={styles.exerciseAlt}>Swap: {exercise.substitutions.slice(0, 2).join(", ")}</Text>
        ) : null}
      </View>
    </View>
  );
}

function MetaChip({ label, tone = "default" }: { label: string; tone?: "default" | "soft" }) {
  return (
    <View style={[styles.metaChip, tone === "soft" && styles.metaChipSoft]}>
      <Text style={[styles.metaChipText, tone === "soft" && styles.metaChipTextSoft]}>{label}</Text>
    </View>
  );
}

function formatRepRange(repMin?: number, repMax?: number) {
  if (typeof repMin === "number" && typeof repMax === "number") {
    return repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`;
  }

  if (typeof repMin === "number") {
    return `${repMin}+`;
  }

  if (typeof repMax === "number") {
    return `${repMax}`;
  }

  return "TBD";
}

function formatWorkoutVolume(exercise: ParsedWorkoutExercise) {
  if (typeof exercise.sets === "number" && typeof exercise.reps === "number") {
    return `${exercise.sets} x ${exercise.reps}`;
  }

  if (typeof exercise.sets === "number" && (typeof exercise.repMin === "number" || typeof exercise.repMax === "number")) {
    return `${exercise.sets} x ${formatRepRange(exercise.repMin, exercise.repMax)}`;
  }

  if (typeof exercise.sets === "number") {
    return `${exercise.sets} sets`;
  }

  return "Needs review";
}

function formatLoad(weight?: number, unit?: string) {
  if (typeof weight !== "number") {
    return null;
  }

  return `${weight}${unit ? ` ${unit}` : ""}`;
}

function formatRest(restSeconds?: number) {
  if (typeof restSeconds !== "number") {
    return null;
  }

  return `rest ${restSeconds}s`;
}

function formatPerformedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildSessionSummary(session: EditableSession) {
  const topExercises = session.exercises
    .slice(0, 3)
    .map((exercise) => exercise.name)
    .join(", ");

  if (session.cleanedSummary) {
    return session.cleanedSummary;
  }

  if (topExercises) {
    return `Likely ${session.sessionTag.toLowerCase()} session built from ${topExercises}.`;
  }

  return `Review and adjust this ${session.sessionTag.toLowerCase()} session before saving it.`;
}

function formatNumeric(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function roundStep(value: number) {
  return Math.round(value * 10) / 10;
}

function inferSessionTag(session: ParsedWorkout): SessionTag {
  const raw = `${session.title ?? ""} ${session.sessionType ?? ""}`.toLowerCase();
  if (/jamb|leg|lower/.test(raw)) return "Jambes";
  if (/dos|back|pull/.test(raw)) return "Dos";
  if (/pec|chest/.test(raw)) return "Pec";
  if (/push/.test(raw)) return "Push";
  if (/upper/.test(raw)) return "Upper";
  if (/bras|arm/.test(raw)) return "Bras";
  if (/epaul|shoulder/.test(raw)) return "Epaules";
  return "Upper";
}

function inferWeekLabel(title: string | undefined, index: number) {
  const match = title?.match(/semaine\s*(\d+)/i);
  if (match) {
    return `Semaine ${match[1]}`;
  }

  return index < 3 ? "Semaine 1" : "Semaine 2";
}

function toParsedWorkout(session: EditableSession): ParsedWorkout {
  return {
    title: session.title,
    sessionType: session.sessionType,
    performedAt: session.performedAt,
    cleanedSummary: session.cleanedSummary,
    fatigueNote: session.fatigueNote,
    parseConfidence: session.parseConfidence,
    exercises: session.exercises,
  };
}

function buildSessionRawText(session: EditableSession) {
  return [session.weekLabel, session.sessionTag, ...session.exercises.map((exercise) => exercise.rawLine ?? exercise.name)].join("\n");
}

function updateSession(
  sessionId: string,
  patch: Partial<EditableSession>,
  setEditableSessions: Dispatch<SetStateAction<EditableSession[]>>,
  activeSessionId: string | null,
  setParsedWorkout: Dispatch<SetStateAction<ParsedWorkout | null>>,
) {
  setEditableSessions((current) => {
    const next = current.map((session) => (session.id === sessionId ? { ...session, ...patch } : session));
    const active = next.find((session) => session.id === (activeSessionId ?? sessionId));
    if (active) {
      setParsedWorkout(toParsedWorkout(active));
    }
    return next;
  });
}

function adjustExercise(
  sessionId: string,
  exerciseIndex: number,
  patch: Partial<ParsedWorkoutExercise>,
  setEditableSessions: Dispatch<SetStateAction<EditableSession[]>>,
  activeSessionId: string | null,
  setParsedWorkout: Dispatch<SetStateAction<ParsedWorkout | null>>,
) {
  setEditableSessions((current) => {
    const next = current.map((session) => {
      if (session.id !== sessionId) return session;
      const exercises = session.exercises.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, ...patch } : exercise,
      );
      return { ...session, exercises };
    });
    const active = next.find((session) => session.id === (activeSessionId ?? sessionId));
    if (active) {
      setParsedWorkout(toParsedWorkout(active));
    }
    return next;
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    padding: 10,
  },
  container: {
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerRow: {
    position: "relative",
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 68,
  },
  backTap: {
    position: "absolute",
    left: 0,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9dbdf",
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#2a2d34",
    fontWeight: "600",
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    fontWeight: "700",
    color: "#12151b",
    textAlign: "center",
    maxWidth: "100%",
  },
  headerSpacer: {
    position: "absolute",
    right: 0,
    width: 68,
    height: 44,
  },
  sectionTitle: {
    marginTop: 16,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#20242b",
    fontWeight: "700",
  },
  sectionBody: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#666c75",
  },
  inputBox: {
    marginTop: 10,
    minHeight: 116,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d5d6da",
    backgroundColor: "#f5f5f6",
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontFamily: Fonts.mono,
    ...Typography.bodySmall,
    color: "#262a31",
    textAlignVertical: "top",
  },
  primaryButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#090b10",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f4f6f9",
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 10,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#e8e1d0",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#151820",
    fontWeight: "700",
  },
  resultLabel: {
    marginTop: 14,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8e949d",
    fontWeight: "600",
  },
  resultCard: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  directSessionCard: {
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ebe7de",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  directSessionCardSelected: {
    borderColor: "#111318",
    backgroundColor: "#fcfbf7",
  },
  directSessionCardDragging: {
    opacity: 0.92,
  },
  draggableList: {
    flexGrow: 0,
  },
  draggableContent: {
    gap: 8,
  },
  loadingCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  excerptCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ebe7de",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  excerptText: {
    fontFamily: Fonts.mono,
    ...Typography.bodySmall,
    color: "#31363f",
    lineHeight: 22,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    flexShrink: 1,
    gap: 4,
  },
  summaryEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#141821",
    fontWeight: "700",
  },
  summaryBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#5d636c",
    lineHeight: 20,
  },
  metaBadge: {
    minWidth: 72,
    borderRadius: 14,
    backgroundColor: "#111318",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  metaBadgeValue: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#f8f8f8",
    fontWeight: "700",
  },
  metaBadgeLabel: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#c7cbd2",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    borderRadius: 999,
    backgroundColor: "#ece8df",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipSoft: {
    backgroundColor: "#efefef",
  },
  metaChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#2e333b",
    fontWeight: "600",
  },
  metaChipTextSoft: {
    color: "#5f6670",
  },
  exerciseList: {
    gap: 8,
  },
  candidateCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#ebe7de",
    gap: 8,
  },
  candidateCardSelected: {
    borderColor: "#111318",
    backgroundColor: "#fcfbf7",
  },
  candidateHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionActions: {
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 2,
  },
  editButton: {
    borderRadius: 999,
    backgroundColor: "#ece8df",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#1f242c",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inlineEditChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d4cc",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineEditChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#434952",
    fontWeight: "700",
  },
  gripPill: {
    width: 28,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
    flexShrink: 0,
  },
  iconButton: {
    minWidth: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#f7f7f7",
    fontWeight: "700",
  },
  chipPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d4cc",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pickerChipActive: {
    backgroundColor: "#111318",
    borderColor: "#111318",
  },
  pickerChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5d646d",
    fontWeight: "700",
  },
  pickerChipTextActive: {
    color: "#f8f8f8",
  },
  weekRow: {
    gap: 6,
  },
  editorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  editorGhostButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7d3cb",
    backgroundColor: "#f8f6f1",
    alignItems: "center",
    justifyContent: "center",
  },
  editorGhostButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#30353d",
    fontWeight: "700",
  },
  editorPrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
  },
  editorPrimaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#f7f7f7",
    fontWeight: "700",
  },
  sessionPreviewList: {
    gap: 10,
  },
  sessionPreviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  sessionPreviewName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#1b2028",
    fontWeight: "700",
  },
  sessionPreviewDetail: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6a7079",
  },
  sessionPreviewMore: {
    marginTop: -2,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    fontWeight: "600",
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  weekInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ded9cf",
    backgroundColor: "#f8f7f3",
    paddingHorizontal: 12,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#262b33",
  },
  editExerciseCard: {
    borderRadius: 12,
    backgroundColor: "#fbfbfb",
    borderWidth: 1,
    borderColor: "#ece7df",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stepperCard: {
    minWidth: 128,
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#f4f1ea",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#181c23",
    fontWeight: "700",
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#ebe7de",
  },
  exerciseMain: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  exerciseVolume: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#2d333c",
  },
  exerciseDetail: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6b717a",
  },
  exerciseNote: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#3e434c",
  },
  exerciseAlt: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6b717a",
  },
  confidenceBadge: {
    borderRadius: 999,
    backgroundColor: "#ebf6ef",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confidenceText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#2e8b57",
    fontWeight: "700",
  },
  divider: {
    marginTop: 20,
    height: 1,
    backgroundColor: "#e4e5e8",
  },
  coachSummary: {
    marginTop: 12,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#242830",
  },
  errorCard: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e7b1ac",
    backgroundColor: "#fff3f1",
    padding: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#a3342a",
  },
  pressed: {
    opacity: 0.9,
  },
});
