from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.collet import Collet
    from ..models.extension import Extension
    from ..models.holder import Holder
    from ..models.insert_tool import InsertTool
    from ..models.tool import Tool


T = TypeVar("T", bound="RotatingToolAssembly")


@_attrs_define
class RotatingToolAssembly:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A tool as it is put in the spindle: the tool, what holds it, and how far it stands out.

        Attributes:
            tool (InsertTool | Tool): The cutting tool, solid or insert, told apart by `type`; either states what stands
                above its flutes as one cone stack, `shaft`.
            holder (Holder | None): What holds the tool; null where it is not known.
            collet (Collet | None): The collet clamping the tool; null where there is none or it is not known.
            stickout (float): Tool tip to the holder face, mm.
            extension (Extension | Unset): **Experimental.** Available now and still gaining functionality. It may change in
                breaking ways in a minor API release; each such change is listed in the release notes, so check them before
                upgrading.

                A modular extension a cutting head screws onto; what the holder clamps.
            extension_protrusion (float | Unset): The extension’s head face to the holder face, mm, where an extension is
                present: the head stands out of the extension by `stickout − extensionProtrusion`. Greater than zero and less
                than `stickout`; a value outside that states no place and is not swept or drawn.
            number (int | Unset): The shop’s tool (T) number, where it is stated.
    """

    tool: InsertTool | Tool
    holder: Holder | None
    collet: Collet | None
    stickout: float
    extension: Extension | Unset = UNSET
    extension_protrusion: float | Unset = UNSET
    number: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.collet import Collet
        from ..models.holder import Holder
        from ..models.tool import Tool

        tool: dict[str, Any]
        if isinstance(self.tool, Tool):
            tool = self.tool.to_dict()
        else:
            tool = self.tool.to_dict()

        holder: dict[str, Any] | None
        if isinstance(self.holder, Holder):
            holder = self.holder.to_dict()
        else:
            holder = self.holder

        collet: dict[str, Any] | None
        if isinstance(self.collet, Collet):
            collet = self.collet.to_dict()
        else:
            collet = self.collet

        stickout = self.stickout

        extension: dict[str, Any] | Unset = UNSET
        if not isinstance(self.extension, Unset):
            extension = self.extension.to_dict()

        extension_protrusion = self.extension_protrusion

        number = self.number

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "tool": tool,
                "holder": holder,
                "collet": collet,
                "stickout": stickout,
            }
        )
        if extension is not UNSET:
            field_dict["extension"] = extension
        if extension_protrusion is not UNSET:
            field_dict["extensionProtrusion"] = extension_protrusion
        if number is not UNSET:
            field_dict["number"] = number

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.collet import Collet
        from ..models.extension import Extension
        from ..models.holder import Holder
        from ..models.insert_tool import InsertTool
        from ..models.tool import Tool

        d = dict(src_dict)

        def _parse_tool(data: object) -> InsertTool | Tool:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                tool_type_0 = Tool.from_dict(data)

                return tool_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            tool_type_1 = InsertTool.from_dict(data)

            return tool_type_1

        tool = _parse_tool(d.pop("tool"))

        def _parse_holder(data: object) -> Holder | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                holder_type_0 = Holder.from_dict(data)

                return holder_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(Holder | None, data)

        holder = _parse_holder(d.pop("holder"))

        def _parse_collet(data: object) -> Collet | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                collet_type_0 = Collet.from_dict(data)

                return collet_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(Collet | None, data)

        collet = _parse_collet(d.pop("collet"))

        stickout = d.pop("stickout")

        _extension = d.pop("extension", UNSET)
        extension: Extension | Unset
        if isinstance(_extension, Unset):
            extension = UNSET
        else:
            extension = Extension.from_dict(_extension)

        extension_protrusion = d.pop("extensionProtrusion", UNSET)

        number = d.pop("number", UNSET)

        rotating_tool_assembly = cls(
            tool=tool,
            holder=holder,
            collet=collet,
            stickout=stickout,
            extension=extension,
            extension_protrusion=extension_protrusion,
            number=number,
        )

        rotating_tool_assembly.additional_properties = d
        return rotating_tool_assembly

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
