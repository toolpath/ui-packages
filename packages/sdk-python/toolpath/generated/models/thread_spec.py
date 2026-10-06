from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..models.thread_handedness import ThreadHandedness
from ..types import UNSET, Unset

T = TypeVar("T", bound="ThreadSpec")


@_attrs_define
class ThreadSpec:
    """The thread a hole is to receive.

    Every diameter, the pitch and `threadPercentage` are finite and positive,
    `threadPercentage` at most 100, `minMinorDiameter` no more than `maxMinorDiameter`, and
    `minMajorDiameter` above `minMinorDiameter`; the two angles keep the ranges their fields
    state.

        Attributes:
            basic_diameter (float): Nominal major diameter of the thread, in mm.
            thread_pitch (float): Distance between thread crests, in mm.
            min_minor_diameter (float): Smallest allowed minor diameter, in mm.
            max_minor_diameter (float): Largest allowed minor diameter, in mm.
            min_major_diameter (float): Smallest allowed major diameter, in mm.
            thread_percentage (float): How much of the theoretical thread depth is to be formed, as a percentage.
            handedness (ThreadHandedness | Unset): Which way a thread turns.
            thread_profile_deg (float | Unset): The thread's form: the included angle between its flanks, in degrees,
                strictly between
                0 and 180; absent, 60 — ISO metric, Unified and the American pipe threads. Whitworth and
                the British threads are 55. A tool cuts only a thread of its own form.
            thread_taper_deg (float | Unset): The thread's taper: the half angle between its pitch cone and its axis, in
                degrees, at
                least 0 and below 90; absent, 0, a straight thread. A tapered pipe thread (NPT, BSPT) is
                1 in 16 on the diameter, 1.79°. A tapered catalog thread (NPT, NPTF, Rc) is cut with a
                cutting tap, its standard's length in from the face; nothing else cuts a tapered thread
                yet, and its thread is otherwise left unmachined.
    """

    basic_diameter: float
    thread_pitch: float
    min_minor_diameter: float
    max_minor_diameter: float
    min_major_diameter: float
    thread_percentage: float
    handedness: ThreadHandedness | Unset = UNSET
    thread_profile_deg: float | Unset = UNSET
    thread_taper_deg: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        basic_diameter = self.basic_diameter

        thread_pitch = self.thread_pitch

        min_minor_diameter = self.min_minor_diameter

        max_minor_diameter = self.max_minor_diameter

        min_major_diameter = self.min_major_diameter

        thread_percentage = self.thread_percentage

        handedness: str | Unset = UNSET
        if not isinstance(self.handedness, Unset):
            handedness = self.handedness.value

        thread_profile_deg = self.thread_profile_deg

        thread_taper_deg = self.thread_taper_deg

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "basicDiameter": basic_diameter,
                "threadPitch": thread_pitch,
                "minMinorDiameter": min_minor_diameter,
                "maxMinorDiameter": max_minor_diameter,
                "minMajorDiameter": min_major_diameter,
                "threadPercentage": thread_percentage,
            }
        )
        if handedness is not UNSET:
            field_dict["handedness"] = handedness
        if thread_profile_deg is not UNSET:
            field_dict["threadProfileDeg"] = thread_profile_deg
        if thread_taper_deg is not UNSET:
            field_dict["threadTaperDeg"] = thread_taper_deg

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        basic_diameter = d.pop("basicDiameter")

        thread_pitch = d.pop("threadPitch")

        min_minor_diameter = d.pop("minMinorDiameter")

        max_minor_diameter = d.pop("maxMinorDiameter")

        min_major_diameter = d.pop("minMajorDiameter")

        thread_percentage = d.pop("threadPercentage")

        _handedness = d.pop("handedness", UNSET)
        handedness: ThreadHandedness | Unset
        if isinstance(_handedness, Unset):
            handedness = UNSET
        else:
            handedness = ThreadHandedness(_handedness)

        thread_profile_deg = d.pop("threadProfileDeg", UNSET)

        thread_taper_deg = d.pop("threadTaperDeg", UNSET)

        thread_spec = cls(
            basic_diameter=basic_diameter,
            thread_pitch=thread_pitch,
            min_minor_diameter=min_minor_diameter,
            max_minor_diameter=max_minor_diameter,
            min_major_diameter=min_major_diameter,
            thread_percentage=thread_percentage,
            handedness=handedness,
            thread_profile_deg=thread_profile_deg,
            thread_taper_deg=thread_taper_deg,
        )

        return thread_spec
