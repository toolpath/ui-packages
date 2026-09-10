from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.plan_summary import PlanSummary


T = TypeVar("T", bound="PlanListResponse")


@_attrs_define
class PlanListResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        items (list[PlanSummary]): The part’s plans in this page, newest first.
        page (int): One-based page number returned.
        page_size (int): Maximum number of plans returned in this page.
        total (int): Total number of plans for this part.
    """

    part_id: UUID
    items: list[PlanSummary]
    page: int
    page_size: int
    total: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_id = str(self.part_id)

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)

        page = self.page

        page_size = self.page_size

        total = self.total

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "items": items,
                "page": page,
                "pageSize": page_size,
                "total": total,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_summary import PlanSummary

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        items = []
        _items = d.pop("items")
        for items_item_data in _items:
            items_item = PlanSummary.from_dict(items_item_data)

            items.append(items_item)

        page = d.pop("page")

        page_size = d.pop("pageSize")

        total = d.pop("total")

        plan_list_response = cls(
            part_id=part_id,
            items=items,
            page=page,
            page_size=page_size,
            total=total,
        )

        plan_list_response.additional_properties = d
        return plan_list_response

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
