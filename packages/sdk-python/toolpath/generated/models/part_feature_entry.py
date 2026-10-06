from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.feature_datasheet import FeatureDatasheet


T = TypeVar("T", bound="PartFeatureEntry")


@_attrs_define
class PartFeatureEntry:
    """
    Attributes:
        feature_id (UUID): Identifier of the resolved feature.
        feature_tag (str): Kernel feature tag, encoded as a lowercase hexadecimal string. Stable across runs of one
            kernel version, not across versions.
        feature_type (str): Kernel-recognized feature type; the vocabulary is open-ended.
        datasheet (FeatureDatasheet | None | Unset): Generated machining detail, or null when this feature has no detail
            yet.
    """

    feature_id: UUID
    feature_tag: str
    feature_type: str
    datasheet: FeatureDatasheet | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.feature_datasheet import FeatureDatasheet

        feature_id = str(self.feature_id)

        feature_tag = self.feature_tag

        feature_type = self.feature_type

        datasheet: dict[str, Any] | None | Unset
        if isinstance(self.datasheet, Unset):
            datasheet = UNSET
        elif isinstance(self.datasheet, FeatureDatasheet):
            datasheet = self.datasheet.to_dict()
        else:
            datasheet = self.datasheet

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "featureId": feature_id,
                "featureTag": feature_tag,
                "featureType": feature_type,
            }
        )
        if datasheet is not UNSET:
            field_dict["datasheet"] = datasheet

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.feature_datasheet import FeatureDatasheet

        d = dict(src_dict)
        feature_id = UUID(d.pop("featureId"))

        feature_tag = d.pop("featureTag")

        feature_type = d.pop("featureType")

        def _parse_datasheet(data: object) -> FeatureDatasheet | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                datasheet_type_0 = FeatureDatasheet.from_dict(data)

                return datasheet_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FeatureDatasheet | None | Unset, data)

        datasheet = _parse_datasheet(d.pop("datasheet", UNSET))

        part_feature_entry = cls(
            feature_id=feature_id,
            feature_tag=feature_tag,
            feature_type=feature_type,
            datasheet=datasheet,
        )

        part_feature_entry.additional_properties = d
        return part_feature_entry

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
