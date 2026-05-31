import PivotDestekTable from "./PivotDestekTable";

export default function GenelDestekTable() {
  return (
    <PivotDestekTable
      endpoint="genel-destek"
      title="Tarımsal Destek Kalemleri"
      excelSheet="Genel Destekler"
      excelFile="genel_destek"
    />
  );
}