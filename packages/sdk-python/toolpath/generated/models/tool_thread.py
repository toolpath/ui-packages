from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.tool_thread_tip import ToolThreadTip


T = TypeVar("T", bound="ToolThread")


@_attrs_define
class ToolThread:
    """The thread a tap or thread mill cuts.

    Attributes:
        pitch (float): Axial distance between threads, mm: for a single-point thread mill, the top of its range.
        pitch_min (float | Unset): The bottom of a single-point thread mill’s pitch range, mm (Fusion’s `TPN`); absent
            for a mill of several teeth.
        teeth (int | Unset): How many teeth a thread mill has (Fusion’s `NT`): 1 for a single-point mill.
        tip (ToolThreadTip | Unset): A thread mill’s tooth tip (Fusion’s `thread-tip-type`), which decides the root of
            the thread it cuts.
        partial_threads (float | Unset): Threads ground away at a tap’s nose, its lead: how far past the thread’s end it
            must run.
        handedness (str | Unset): The hand a tap cuts, which the kernel reads; a thread mill has none. Known values:
            `right`, `left`. Other values may be added.
        profile_deg (float | Unset): Included angle between the thread’s flanks, degrees.
        taper_deg (float | Unset): Half angle of the thread’s pitch cone to the axis, degrees: 0 for a straight thread.
    """

    pitch: float
    pitch_min: float | Unset = UNSET
    teeth: int | Unset = UNSET
    tip: ToolThreadTip | Unset = UNSET
    partial_threads: float | Unset = UNSET
    handedness: str | Unset = UNSET
    profile_deg: float | Unset = UNSET
    taper_deg: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        pitch = self.pitch

        pitch_min = self.pitch_min

        teeth = self.teeth

        tip: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tip, Unset):
            tip = self.tip.to_dict()

        partial_threads = self.partial_threads

        handedness = self.handedness

        profile_deg = self.profile_deg

        taper_deg = self.taper_deg

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "pitch": pitch,
            }
        )
        if pitch_min is not UNSET:
            field_dict["pitchMin"] = pitch_min
        if teeth is not UNSET:
            field_dict["teeth"] = teeth
        if tip is not UNSET:
            field_dict["tip"] = tip
        if partial_threads is not UNSET:
            field_dict["partialThreads"] = partial_threads
        if handedness is not UNSET:
            field_dict["handedness"] = handedness
        if profile_deg is not UNSET:
            field_dict["profileDeg"] = profile_deg
        if taper_deg is not UNSET:
            field_dict["taperDeg"] = taper_deg

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.tool_thread_tip import ToolThreadTip

        d = dict(src_dict)
        pitch = d.pop("pitch")

        pitch_min = d.pop("pitchMin", UNSET)

        teeth = d.pop("teeth", UNSET)

        _tip = d.pop("tip", UNSET)
        tip: ToolThreadTip | Unset
        if isinstance(_tip, Unset):
            tip = UNSET
        else:
            tip = ToolThreadTip.from_dict(_tip)

        partial_threads = d.pop("partialThreads", UNSET)

        handedness = d.pop("handedness", UNSET)

        profile_deg = d.pop("profileDeg", UNSET)

        taper_deg = d.pop("taperDeg", UNSET)

        tool_thread = cls(
            pitch=pitch,
            pitch_min=pitch_min,
            teeth=teeth,
            tip=tip,
            partial_threads=partial_threads,
            handedness=handedness,
            profile_deg=profile_deg,
            taper_deg=taper_deg,
        )

        tool_thread.additional_properties = d
        return tool_thread

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
