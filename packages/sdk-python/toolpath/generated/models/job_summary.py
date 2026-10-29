from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.job_summary_status import JobSummaryStatus

T = TypeVar("T", bound="JobSummary")


@_attrs_define
class JobSummary:
    """
    Attributes:
        part_uuid (None | UUID): Identifier of the part this job processes, or null when its subject is a holder or a
            file.
        holder_uuid (None | UUID): Identifier of the holder this job processes, or null when its subject is a part or a
            file.
        file_uuid (None | UUID): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            Identifier of the file this job inspects, or null when its subject is a part or a holder.
        job_uuid (UUID): Identifier of this job.
        product_type (str): Product operation performed by the job, such as part processing, feature-detail processing,
            holder import, or file inspection.
        status (JobSummaryStatus): Current state of the job: `queued` until a worker starts it, then `running` until it
            finishes, including while it waits to be retried after a failed attempt. `succeeded` and `failed` are final: a
            job in either state never changes again.
        progress (int | None): Worker-reported completion percentage, or null before progress is available.
        created_at (datetime.datetime): Time at which the job was created, in ISO 8601 format.
    """

    part_uuid: None | UUID
    holder_uuid: None | UUID
    file_uuid: None | UUID
    job_uuid: UUID
    product_type: str
    status: JobSummaryStatus
    progress: int | None
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_uuid: None | str
        if isinstance(self.part_uuid, UUID):
            part_uuid = str(self.part_uuid)
        else:
            part_uuid = self.part_uuid

        holder_uuid: None | str
        if isinstance(self.holder_uuid, UUID):
            holder_uuid = str(self.holder_uuid)
        else:
            holder_uuid = self.holder_uuid

        file_uuid: None | str
        if isinstance(self.file_uuid, UUID):
            file_uuid = str(self.file_uuid)
        else:
            file_uuid = self.file_uuid

        job_uuid = str(self.job_uuid)

        product_type = self.product_type

        status = self.status.value

        progress: int | None
        progress = self.progress

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partUuid": part_uuid,
                "holderUuid": holder_uuid,
                "fileUuid": file_uuid,
                "jobUuid": job_uuid,
                "productType": product_type,
                "status": status,
                "progress": progress,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_part_uuid(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                part_uuid_type_0 = UUID(data)

                return part_uuid_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        part_uuid = _parse_part_uuid(d.pop("partUuid"))

        def _parse_holder_uuid(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                holder_uuid_type_0 = UUID(data)

                return holder_uuid_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        holder_uuid = _parse_holder_uuid(d.pop("holderUuid"))

        def _parse_file_uuid(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                file_uuid_type_0 = UUID(data)

                return file_uuid_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        file_uuid = _parse_file_uuid(d.pop("fileUuid"))

        job_uuid = UUID(d.pop("jobUuid"))

        product_type = d.pop("productType")

        status = JobSummaryStatus(d.pop("status"))

        def _parse_progress(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        progress = _parse_progress(d.pop("progress"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        job_summary = cls(
            part_uuid=part_uuid,
            holder_uuid=holder_uuid,
            file_uuid=file_uuid,
            job_uuid=job_uuid,
            product_type=product_type,
            status=status,
            progress=progress,
            created_at=created_at,
        )

        job_summary.additional_properties = d
        return job_summary

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
