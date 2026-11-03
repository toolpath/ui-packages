from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.hole_bottom import HoleBottom
    from ..models.hole_step import HoleStep
    from ..models.hole_thread import HoleThread


T = TypeVar("T", bound="TurnedAxialHoleFacts")


@_attrs_define
class TurnedAxialHoleFacts:
    """A hole on the axis.

    Attributes:
        kind (Literal['AxialHole']): Discriminant of a `TurnedFeatureFacts`; always `'AxialHole'` here.
        through (bool): Whether it runs through the part.
        depth (float): Its extent along the axis, in mm.
        steps (list[HoleStep]): Its cylinders, from the mouth inward.
        is_through (bool | Unset): Whether it runs through the part.
        bottom (HoleBottom | Unset): Where a blind hole ends.
        thread (HoleThread | Unset): A thread cut in an axial hole.
    """

    kind: Literal["AxialHole"]
    through: bool
    depth: float
    steps: list[HoleStep]
    is_through: bool | Unset = UNSET
    bottom: HoleBottom | Unset = UNSET
    thread: HoleThread | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        through = self.through

        depth = self.depth

        steps = []
        for steps_item_data in self.steps:
            steps_item = steps_item_data.to_dict()
            steps.append(steps_item)

        is_through = self.is_through

        bottom: dict[str, Any] | Unset = UNSET
        if not isinstance(self.bottom, Unset):
            bottom = self.bottom.to_dict()

        thread: dict[str, Any] | Unset = UNSET
        if not isinstance(self.thread, Unset):
            thread = self.thread.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "through": through,
                "depth": depth,
                "steps": steps,
            }
        )
        if is_through is not UNSET:
            field_dict["isThrough"] = is_through
        if bottom is not UNSET:
            field_dict["bottom"] = bottom
        if thread is not UNSET:
            field_dict["thread"] = thread

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.hole_bottom import HoleBottom
        from ..models.hole_step import HoleStep
        from ..models.hole_thread import HoleThread

        d = dict(src_dict)
        kind = cast(Literal["AxialHole"], d.pop("kind"))
        if kind != "AxialHole":
            raise ValueError(f"kind must match const 'AxialHole', got '{kind}'")

        through = d.pop("through")

        depth = d.pop("depth")

        steps = []
        _steps = d.pop("steps")
        for steps_item_data in _steps:
            steps_item = HoleStep.from_dict(steps_item_data)

            steps.append(steps_item)

        is_through = d.pop("isThrough", UNSET)

        _bottom = d.pop("bottom", UNSET)
        bottom: HoleBottom | Unset
        if isinstance(_bottom, Unset):
            bottom = UNSET
        else:
            bottom = HoleBottom.from_dict(_bottom)

        _thread = d.pop("thread", UNSET)
        thread: HoleThread | Unset
        if isinstance(_thread, Unset):
            thread = UNSET
        else:
            thread = HoleThread.from_dict(_thread)

        turned_axial_hole_facts = cls(
            kind=kind,
            through=through,
            depth=depth,
            steps=steps,
            is_through=is_through,
            bottom=bottom,
            thread=thread,
        )

        return turned_axial_hole_facts
