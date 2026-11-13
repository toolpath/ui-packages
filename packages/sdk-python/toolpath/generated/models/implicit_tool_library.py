from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.implicit_tool_library_kind import ImplicitToolLibraryKind
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.implicit_tool_library_ball_endmill import ImplicitToolLibraryBallEndmill
    from ..models.implicit_tool_library_bull_nose import ImplicitToolLibraryBullNose
    from ..models.implicit_tool_library_chamfer import ImplicitToolLibraryChamfer
    from ..models.implicit_tool_library_corner_rounding import ImplicitToolLibraryCornerRounding
    from ..models.implicit_tool_library_drill import ImplicitToolLibraryDrill
    from ..models.implicit_tool_library_face_mill import ImplicitToolLibraryFaceMill
    from ..models.implicit_tool_library_flat_endmill import ImplicitToolLibraryFlatEndmill
    from ..models.implicit_tool_library_keyseat import ImplicitToolLibraryKeyseat
    from ..models.implicit_tool_library_tap import ImplicitToolLibraryTap


T = TypeVar("T", bound="ImplicitToolLibrary")


@_attrs_define
class ImplicitToolLibrary:
    """A tool library whose tools are synthesized from settings, one family at a time.

    Attributes:
        kind (ImplicitToolLibraryKind): Tools synthesized from settings.
        name (str | Unset): A label for the library.
        face_mill (ImplicitToolLibraryFaceMill | Unset): The one face mill: its diameter.
        flat_endmill (ImplicitToolLibraryFlatEndmill | Unset): Flat endmills.
        bull_nose (ImplicitToolLibraryBullNose | Unset): Bull-nose endmills.
        ball_endmill (ImplicitToolLibraryBallEndmill | Unset): Ball endmills.
        drill (ImplicitToolLibraryDrill | Unset): Drills, clipped from the system’s drill series.
        chamfer (ImplicitToolLibraryChamfer | Unset): Chamfer mills.
        keyseat (ImplicitToolLibraryKeyseat | Unset): Keyseat cutters, which cut T-slots.
        tap (ImplicitToolLibraryTap | Unset): Every tool that cuts a thread: cutting and forming taps, and thread mills.
        corner_rounding (ImplicitToolLibraryCornerRounding | Unset): Corner rounders, by the whole cutter’s diameter.
    """

    kind: ImplicitToolLibraryKind
    name: str | Unset = UNSET
    face_mill: ImplicitToolLibraryFaceMill | Unset = UNSET
    flat_endmill: ImplicitToolLibraryFlatEndmill | Unset = UNSET
    bull_nose: ImplicitToolLibraryBullNose | Unset = UNSET
    ball_endmill: ImplicitToolLibraryBallEndmill | Unset = UNSET
    drill: ImplicitToolLibraryDrill | Unset = UNSET
    chamfer: ImplicitToolLibraryChamfer | Unset = UNSET
    keyseat: ImplicitToolLibraryKeyseat | Unset = UNSET
    tap: ImplicitToolLibraryTap | Unset = UNSET
    corner_rounding: ImplicitToolLibraryCornerRounding | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        name = self.name

        face_mill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.face_mill, Unset):
            face_mill = self.face_mill.to_dict()

        flat_endmill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.flat_endmill, Unset):
            flat_endmill = self.flat_endmill.to_dict()

        bull_nose: dict[str, Any] | Unset = UNSET
        if not isinstance(self.bull_nose, Unset):
            bull_nose = self.bull_nose.to_dict()

        ball_endmill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.ball_endmill, Unset):
            ball_endmill = self.ball_endmill.to_dict()

        drill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.drill, Unset):
            drill = self.drill.to_dict()

        chamfer: dict[str, Any] | Unset = UNSET
        if not isinstance(self.chamfer, Unset):
            chamfer = self.chamfer.to_dict()

        keyseat: dict[str, Any] | Unset = UNSET
        if not isinstance(self.keyseat, Unset):
            keyseat = self.keyseat.to_dict()

        tap: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tap, Unset):
            tap = self.tap.to_dict()

        corner_rounding: dict[str, Any] | Unset = UNSET
        if not isinstance(self.corner_rounding, Unset):
            corner_rounding = self.corner_rounding.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name
        if face_mill is not UNSET:
            field_dict["faceMill"] = face_mill
        if flat_endmill is not UNSET:
            field_dict["flatEndmill"] = flat_endmill
        if bull_nose is not UNSET:
            field_dict["bullNose"] = bull_nose
        if ball_endmill is not UNSET:
            field_dict["ballEndmill"] = ball_endmill
        if drill is not UNSET:
            field_dict["drill"] = drill
        if chamfer is not UNSET:
            field_dict["chamfer"] = chamfer
        if keyseat is not UNSET:
            field_dict["keyseat"] = keyseat
        if tap is not UNSET:
            field_dict["tap"] = tap
        if corner_rounding is not UNSET:
            field_dict["cornerRounding"] = corner_rounding

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.implicit_tool_library_ball_endmill import ImplicitToolLibraryBallEndmill
        from ..models.implicit_tool_library_bull_nose import ImplicitToolLibraryBullNose
        from ..models.implicit_tool_library_chamfer import ImplicitToolLibraryChamfer
        from ..models.implicit_tool_library_corner_rounding import ImplicitToolLibraryCornerRounding
        from ..models.implicit_tool_library_drill import ImplicitToolLibraryDrill
        from ..models.implicit_tool_library_face_mill import ImplicitToolLibraryFaceMill
        from ..models.implicit_tool_library_flat_endmill import ImplicitToolLibraryFlatEndmill
        from ..models.implicit_tool_library_keyseat import ImplicitToolLibraryKeyseat
        from ..models.implicit_tool_library_tap import ImplicitToolLibraryTap

        d = dict(src_dict)
        kind = ImplicitToolLibraryKind(d.pop("kind"))

        name = d.pop("name", UNSET)

        _face_mill = d.pop("faceMill", UNSET)
        face_mill: ImplicitToolLibraryFaceMill | Unset
        if isinstance(_face_mill, Unset):
            face_mill = UNSET
        else:
            face_mill = ImplicitToolLibraryFaceMill.from_dict(_face_mill)

        _flat_endmill = d.pop("flatEndmill", UNSET)
        flat_endmill: ImplicitToolLibraryFlatEndmill | Unset
        if isinstance(_flat_endmill, Unset):
            flat_endmill = UNSET
        else:
            flat_endmill = ImplicitToolLibraryFlatEndmill.from_dict(_flat_endmill)

        _bull_nose = d.pop("bullNose", UNSET)
        bull_nose: ImplicitToolLibraryBullNose | Unset
        if isinstance(_bull_nose, Unset):
            bull_nose = UNSET
        else:
            bull_nose = ImplicitToolLibraryBullNose.from_dict(_bull_nose)

        _ball_endmill = d.pop("ballEndmill", UNSET)
        ball_endmill: ImplicitToolLibraryBallEndmill | Unset
        if isinstance(_ball_endmill, Unset):
            ball_endmill = UNSET
        else:
            ball_endmill = ImplicitToolLibraryBallEndmill.from_dict(_ball_endmill)

        _drill = d.pop("drill", UNSET)
        drill: ImplicitToolLibraryDrill | Unset
        if isinstance(_drill, Unset):
            drill = UNSET
        else:
            drill = ImplicitToolLibraryDrill.from_dict(_drill)

        _chamfer = d.pop("chamfer", UNSET)
        chamfer: ImplicitToolLibraryChamfer | Unset
        if isinstance(_chamfer, Unset):
            chamfer = UNSET
        else:
            chamfer = ImplicitToolLibraryChamfer.from_dict(_chamfer)

        _keyseat = d.pop("keyseat", UNSET)
        keyseat: ImplicitToolLibraryKeyseat | Unset
        if isinstance(_keyseat, Unset):
            keyseat = UNSET
        else:
            keyseat = ImplicitToolLibraryKeyseat.from_dict(_keyseat)

        _tap = d.pop("tap", UNSET)
        tap: ImplicitToolLibraryTap | Unset
        if isinstance(_tap, Unset):
            tap = UNSET
        else:
            tap = ImplicitToolLibraryTap.from_dict(_tap)

        _corner_rounding = d.pop("cornerRounding", UNSET)
        corner_rounding: ImplicitToolLibraryCornerRounding | Unset
        if isinstance(_corner_rounding, Unset):
            corner_rounding = UNSET
        else:
            corner_rounding = ImplicitToolLibraryCornerRounding.from_dict(_corner_rounding)

        implicit_tool_library = cls(
            kind=kind,
            name=name,
            face_mill=face_mill,
            flat_endmill=flat_endmill,
            bull_nose=bull_nose,
            ball_endmill=ball_endmill,
            drill=drill,
            chamfer=chamfer,
            keyseat=keyseat,
            tap=tap,
            corner_rounding=corner_rounding,
        )

        return implicit_tool_library
