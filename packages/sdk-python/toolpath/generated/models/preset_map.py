from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PresetMap")


@_attrs_define
class PresetMap:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    Per purpose, the names of a Fusion tool library’s presets, in precedence order: for each purpose, the first of its
    names a tool states and can run prices that purpose for that tool, so a preset whose numbers describe no cut (a zero
    speed, say) passes to the next name. A purpose left out reads no preset, and is priced from the job’s material.

        Attributes:
            face (list[str] | Unset): Preset names for finishing a face, tried in order.
            wall_finish (list[str] | Unset): Preset names for finishing a wall, tried in order.
            floor_finish (list[str] | Unset): Preset names for finishing a floor, tried in order.
            surface (list[str] | Unset): Preset names for finishing a 3D surface, tried in order.
            hole_finish (list[str] | Unset): Preset names for finishing a hole’s wall, tried in order.
            hole_rough (list[str] | Unset): Preset names for roughing a hole, tried in order.
            traditional_rough (list[str] | Unset): Preset names for roughing in constant-depth layers, tried in order.
            adaptive_rough (list[str] | Unset): Preset names for adaptive, high-speed roughing, tried in order.
            face_rough (list[str] | Unset): Preset names for roughing a face, tried in order.
            slot (list[str] | Unset): Preset names for slotting, the tool’s full width engaged, tried in order.
            drill (list[str] | Unset): Preset names for drilling, tried in order.
            chamfer (list[str] | Unset): Preset names for chamfering, tried in order.
            keyseat (list[str] | Unset): Preset names for cutting a keyseat or a T-slot, tried in order.
            dovetail (list[str] | Unset): Preset names for cutting a dovetail, tried in order.
            tap (list[str] | Unset): Preset names for tapping, tried in order.
            thread_mill (list[str] | Unset): Preset names for thread milling, tried in order.
    """

    face: list[str] | Unset = UNSET
    wall_finish: list[str] | Unset = UNSET
    floor_finish: list[str] | Unset = UNSET
    surface: list[str] | Unset = UNSET
    hole_finish: list[str] | Unset = UNSET
    hole_rough: list[str] | Unset = UNSET
    traditional_rough: list[str] | Unset = UNSET
    adaptive_rough: list[str] | Unset = UNSET
    face_rough: list[str] | Unset = UNSET
    slot: list[str] | Unset = UNSET
    drill: list[str] | Unset = UNSET
    chamfer: list[str] | Unset = UNSET
    keyseat: list[str] | Unset = UNSET
    dovetail: list[str] | Unset = UNSET
    tap: list[str] | Unset = UNSET
    thread_mill: list[str] | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        face: list[str] | Unset = UNSET
        if not isinstance(self.face, Unset):
            face = self.face

        wall_finish: list[str] | Unset = UNSET
        if not isinstance(self.wall_finish, Unset):
            wall_finish = self.wall_finish

        floor_finish: list[str] | Unset = UNSET
        if not isinstance(self.floor_finish, Unset):
            floor_finish = self.floor_finish

        surface: list[str] | Unset = UNSET
        if not isinstance(self.surface, Unset):
            surface = self.surface

        hole_finish: list[str] | Unset = UNSET
        if not isinstance(self.hole_finish, Unset):
            hole_finish = self.hole_finish

        hole_rough: list[str] | Unset = UNSET
        if not isinstance(self.hole_rough, Unset):
            hole_rough = self.hole_rough

        traditional_rough: list[str] | Unset = UNSET
        if not isinstance(self.traditional_rough, Unset):
            traditional_rough = self.traditional_rough

        adaptive_rough: list[str] | Unset = UNSET
        if not isinstance(self.adaptive_rough, Unset):
            adaptive_rough = self.adaptive_rough

        face_rough: list[str] | Unset = UNSET
        if not isinstance(self.face_rough, Unset):
            face_rough = self.face_rough

        slot: list[str] | Unset = UNSET
        if not isinstance(self.slot, Unset):
            slot = self.slot

        drill: list[str] | Unset = UNSET
        if not isinstance(self.drill, Unset):
            drill = self.drill

        chamfer: list[str] | Unset = UNSET
        if not isinstance(self.chamfer, Unset):
            chamfer = self.chamfer

        keyseat: list[str] | Unset = UNSET
        if not isinstance(self.keyseat, Unset):
            keyseat = self.keyseat

        dovetail: list[str] | Unset = UNSET
        if not isinstance(self.dovetail, Unset):
            dovetail = self.dovetail

        tap: list[str] | Unset = UNSET
        if not isinstance(self.tap, Unset):
            tap = self.tap

        thread_mill: list[str] | Unset = UNSET
        if not isinstance(self.thread_mill, Unset):
            thread_mill = self.thread_mill

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if face is not UNSET:
            field_dict["face"] = face
        if wall_finish is not UNSET:
            field_dict["wallFinish"] = wall_finish
        if floor_finish is not UNSET:
            field_dict["floorFinish"] = floor_finish
        if surface is not UNSET:
            field_dict["surface"] = surface
        if hole_finish is not UNSET:
            field_dict["holeFinish"] = hole_finish
        if hole_rough is not UNSET:
            field_dict["holeRough"] = hole_rough
        if traditional_rough is not UNSET:
            field_dict["traditionalRough"] = traditional_rough
        if adaptive_rough is not UNSET:
            field_dict["adaptiveRough"] = adaptive_rough
        if face_rough is not UNSET:
            field_dict["faceRough"] = face_rough
        if slot is not UNSET:
            field_dict["slot"] = slot
        if drill is not UNSET:
            field_dict["drill"] = drill
        if chamfer is not UNSET:
            field_dict["chamfer"] = chamfer
        if keyseat is not UNSET:
            field_dict["keyseat"] = keyseat
        if dovetail is not UNSET:
            field_dict["dovetail"] = dovetail
        if tap is not UNSET:
            field_dict["tap"] = tap
        if thread_mill is not UNSET:
            field_dict["threadMill"] = thread_mill

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        face = cast(list[str], d.pop("face", UNSET))

        wall_finish = cast(list[str], d.pop("wallFinish", UNSET))

        floor_finish = cast(list[str], d.pop("floorFinish", UNSET))

        surface = cast(list[str], d.pop("surface", UNSET))

        hole_finish = cast(list[str], d.pop("holeFinish", UNSET))

        hole_rough = cast(list[str], d.pop("holeRough", UNSET))

        traditional_rough = cast(list[str], d.pop("traditionalRough", UNSET))

        adaptive_rough = cast(list[str], d.pop("adaptiveRough", UNSET))

        face_rough = cast(list[str], d.pop("faceRough", UNSET))

        slot = cast(list[str], d.pop("slot", UNSET))

        drill = cast(list[str], d.pop("drill", UNSET))

        chamfer = cast(list[str], d.pop("chamfer", UNSET))

        keyseat = cast(list[str], d.pop("keyseat", UNSET))

        dovetail = cast(list[str], d.pop("dovetail", UNSET))

        tap = cast(list[str], d.pop("tap", UNSET))

        thread_mill = cast(list[str], d.pop("threadMill", UNSET))

        preset_map = cls(
            face=face,
            wall_finish=wall_finish,
            floor_finish=floor_finish,
            surface=surface,
            hole_finish=hole_finish,
            hole_rough=hole_rough,
            traditional_rough=traditional_rough,
            adaptive_rough=adaptive_rough,
            face_rough=face_rough,
            slot=slot,
            drill=drill,
            chamfer=chamfer,
            keyseat=keyseat,
            dovetail=dovetail,
            tap=tap,
            thread_mill=thread_mill,
        )

        return preset_map
