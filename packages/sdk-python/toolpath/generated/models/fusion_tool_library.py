from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define

from ..models.fusion_tool_library_kind import FusionToolLibraryKind
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.preset_map import PresetMap


T = TypeVar("T", bound="FusionToolLibrary")


@_attrs_define
class FusionToolLibrary:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A shop’s own Fusion tool library, uploaded with **Upload a tool library** and named by `toolLibraryId`. Its milling
    tools run at the feeds and speeds of the presets `presets` names, and every purpose those leave is priced for the
    job’s material. The machine’s `maxRpm` holds none of them: a preset runs as stated, and what the presets leave is
    priced under the default ceiling of 15000 rev/min.

        Attributes:
            kind (FusionToolLibraryKind): A Fusion tool library of real tools.
            tool_library_id (UUID): The library, as `POST /v1/tool-libraries` created it, uploaded.
            name (str | Unset): A label for the library.
            presets (PresetMap | Unset): **Experimental.** Available now and still gaining functionality. It may change in
                breaking ways in a minor API release; each such change is listed in the release notes, so check them before
                upgrading.

                Per purpose, the names of a Fusion tool library’s presets, in precedence order: for each purpose, the first of
                its names a tool states and can run prices that purpose for that tool, so a preset whose numbers describe no cut
                (a zero speed, say) passes to the next name. A purpose left out reads no preset, and is priced from the job’s
                material.
    """

    kind: FusionToolLibraryKind
    tool_library_id: UUID
    name: str | Unset = UNSET
    presets: PresetMap | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        tool_library_id = str(self.tool_library_id)

        name = self.name

        presets: dict[str, Any] | Unset = UNSET
        if not isinstance(self.presets, Unset):
            presets = self.presets.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "toolLibraryId": tool_library_id,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name
        if presets is not UNSET:
            field_dict["presets"] = presets

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.preset_map import PresetMap

        d = dict(src_dict)
        kind = FusionToolLibraryKind(d.pop("kind"))

        tool_library_id = UUID(d.pop("toolLibraryId"))

        name = d.pop("name", UNSET)

        _presets = d.pop("presets", UNSET)
        presets: PresetMap | Unset
        if isinstance(_presets, Unset):
            presets = UNSET
        else:
            presets = PresetMap.from_dict(_presets)

        fusion_tool_library = cls(
            kind=kind,
            tool_library_id=tool_library_id,
            name=name,
            presets=presets,
        )

        return fusion_tool_library
