from __future__ import annotations

CATEGORIES = [
    {
        "id": "lift",
        "name": "Lift",
        "exercises": [
            {"id": "squat", "name": "Squat"},
            {"id": "deadlift", "name": "Deadlift"},
        ],
    }
]


def list_categories() -> list[dict]:
    return [{"id": item["id"], "name": item["name"]} for item in CATEGORIES]


def get_category(category_id: str) -> dict | None:
    for category in CATEGORIES:
        if category["id"] == category_id:
            return category
    return None


def get_exercise(exercise_id: str) -> dict | None:
    for category in CATEGORIES:
        for exercise in category["exercises"]:
            if exercise["id"] == exercise_id:
                return {**exercise, "category": category["id"]}
    return None


def list_exercises(category_id: str | None = None) -> list[dict]:
    if category_id is None:
        items = []
        for category in CATEGORIES:
            for exercise in category["exercises"]:
                items.append({**exercise, "category": category["id"]})
        return items
    category = get_category(category_id)
    if category is None:
        return []
    return [{**exercise, "category": category_id} for exercise in category["exercises"]]


def validate_catalogue() -> None:
    seen: set[str] = set()
    for category in CATEGORIES:
        if category["id"] != category["id"].lower() or " " in category["id"]:
            raise ValueError(f"Category id must be lowercase snake_case: {category['id']}")
        for exercise in category["exercises"]:
            if exercise["id"] != exercise["id"].lower() or " " in exercise["id"]:
                raise ValueError(f"Exercise id must be lowercase snake_case: {exercise['id']}")
            if exercise["id"] in seen:
                raise ValueError(f"Duplicate exercise id {exercise['id']}")
            seen.add(exercise["id"])
