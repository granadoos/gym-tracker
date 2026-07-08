const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
};

export type TrainingPlan = {
  id: number;
  name: string;
};

export type PlanDay = {
  id: number;
  plan_id: number | null;
  day_of_week: number;
  workout_type: "normal" | "circuit";
  circuit_rest_seconds: number | null;
};

export type PlanExercise = {
  id: number;
  plan_day_id: number;
  day_of_week: number;
  training_plan_name?: string;
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  default_sets: number;
  default_reps: number | null;
  default_weight: number | null;
  default_time_seconds: number | null;
};

export type WorkoutSet = {
  id: number;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  completed: boolean;
};

export type WorkoutExerciseFull = {
  id: number;
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  sets: WorkoutSet[];
};

export type WorkoutFull = {
  id: number;
  status: "in_progress" | "completed";
  date: string;
  workout_type: "normal" | "circuit";
  circuit_rest_seconds: number | null;
  exercises: WorkoutExerciseFull[];
};

export type WorkoutSummary = {
  id: number;
  plan_day_id: number | null;
  status: "in_progress" | "completed";
  date: string;
};

export type CreateExerciseInput = {
  name: string;
  muscle_group: string;
};

export type CreatePlanInput = {
  name: string;
};

export type CreatePlanDayInput = {
  day_of_week: number;
};

export type CreatePlanExerciseInput = {
  exercise_id: number;
  order_index: number;
  default_sets: number;
  default_reps: number | null;
  default_weight: number | null;
  default_time_seconds: number | null;
};

export type UpdateSetInput = {
  reps?: number | null;
  weight?: number | null;
  duration_seconds?: number | null;
  completed?: boolean;
};

export const api = {
  getExercises: () => request<Exercise[]>("/exercises"),
  createExercise: (input: CreateExerciseInput) =>
    request<Exercise>("/exercises", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteExercise: (exerciseId: number) =>
    request<{ message: string }>(`/exercises/${exerciseId}`, {
      method: "DELETE",
    }),

  getPlans: () => request<TrainingPlan[]>("/plans"),
  createPlan: (input: CreatePlanInput) =>
    request<TrainingPlan>("/plans", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deletePlan: (planId: number) =>
    request<{ message: string }>(`/plans/${planId}`, {
      method: "DELETE",
    }),

  getPlanDays: () => request<PlanDay[]>("/plans/days"),
  createPlanDay: (planId: number, input: CreatePlanDayInput) =>
    request<PlanDay>(`/plans/${planId}/days`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deletePlanDay: (planDayId: number) =>
    request<{ message: string }>(`/plans/days/${planDayId}`, {
      method: "DELETE",
    }),
  updatePlanDayPlan: (planDayId: number, planId: number | null) =>
    request<PlanDay>(`/plans/days/${planDayId}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan_id: planId }),
    }),
  updatePlanDayWorkoutType: (
    planDayId: number,
    workoutType: "normal" | "circuit",
    circuitRestSeconds: number | null
  ) =>
    request<PlanDay>(`/plans/days/${planDayId}/workout-type`, {
      method: "PATCH",
      body: JSON.stringify({
        workout_type: workoutType,
        circuit_rest_seconds: circuitRestSeconds,
      }),
    }),

  getPlanExercises: (planDayId: number) =>
    request<PlanExercise[]>(`/plans/days/${planDayId}/exercises`),
  createPlanExercise: (planDayId: number, input: CreatePlanExerciseInput) =>
    request<PlanExercise>(`/plans/days/${planDayId}/exercises`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePlanDayExercisesDefaultSets: (planDayId: number, defaultSets: number) =>
    request<{ message: string; updated_count: number }>(
      `/plans/days/${planDayId}/exercises/bulk-default-sets`,
      {
        method: "PATCH",
        body: JSON.stringify({ default_sets: defaultSets }),
      }
    ),
  deletePlanExercise: (planDayId: number, planExerciseId: number) =>
    request<{ message: string }>(
      `/plans/days/${planDayId}/exercises/${planExerciseId}`,
      {
        method: "DELETE",
      }
    ),
  touchPlanExercise: (planDayId: number, planExerciseId: number) =>
    request<PlanExercise>(
      `/plans/days/${planDayId}/exercises/${planExerciseId}/touch`,
      {
        method: "POST",
      }
    ),

  startWorkout: (planDayId: number) =>
    request<{ message: string; workout_id: number }>(
      `/workouts/start/${planDayId}`,
      {
        method: "POST",
      }
    ),
  getWorkouts: () => request<WorkoutSummary[]>("/workouts"),
  getWorkout: (workoutId: number) => request<WorkoutSummary>(`/workouts/${workoutId}`),
  getWorkoutFull: (workoutId: number) =>
    request<WorkoutFull>(`/workouts/${workoutId}/full`),
  deleteWorkout: (workoutId: number) =>
    request<{ message: string }>(`/workouts/${workoutId}`, {
      method: "DELETE",
    }),
  finishWorkout: (workoutId: number) =>
    request<{ message: string }>(`/workouts/${workoutId}/finish`, {
      method: "POST",
    }),
  updateSet: (setId: number, input: UpdateSetInput) => {
    const params = new URLSearchParams();

    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });

    return request<WorkoutSet>(`/sets/${setId}?${params.toString()}`, {
      method: "PATCH",
    });
  },
};
