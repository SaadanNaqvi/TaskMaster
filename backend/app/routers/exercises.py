from __future__ import annotations

from fastapi import APIRouter

from ..catalogue import list_categories, list_exercises
from ..schemas import Category, Exercise
from ..gates import require_category

router = APIRouter()


@router.get("/exercises", response_model=list[Category])
def list_exercises_route():
    return list_categories()


@router.get("/exercises/{category_id}", response_model=list[Exercise])
def get_exercises_in_category(category_id: str):
    require_category(category_id)
    return [Exercise(**item) for item in list_exercises(category_id)]
