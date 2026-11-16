using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>Listado de organizaciones: paginación, orden y filtros (contrato §1.2), aislados por prefijo único.</summary>
[Collection(MdmApiCollection.Name)]
public sealed class ListingE2ETest(MdmApiFixture fixture) : EndToEndTestBase(fixture)
{
    private async Task<(System.Text.Json.JsonElement Page, string[] Codes)> ListAsync(string query)
    {
        using var response = await SendAsync(new Call(HttpMethod.Get, TenantsUrl + query));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(Ct));
        var page = await JsonOf(response);
        return (page, page.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("code").GetString()!).ToArray());
    }

    private async Task<string[]> SeedAsync()
    {
        string[] codes = [$"L{Unique}-A", $"L{Unique}-B", $"L{Unique}-C", $"L{Unique}-D", $"L{Unique}-E"];
        foreach (var code in codes)
        {
            await CreateTenantAsync(code);
        }

        return codes;
    }

    [Fact]
    public async Task Pagina_con_totales_y_orden_ascendente_por_defecto()
    {
        RequireApi();
        var codes = await SeedAsync();

        var (first, firstCodes) = await ListAsync($"?search=L{Unique}&pageSize=2");
        var (third, thirdCodes) = await ListAsync($"?search=L{Unique}&pageSize=2&page=3");

        firstCodes.Should().Equal(codes[0], codes[1]);
        first.GetProperty("page").GetInt32().Should().Be(1);
        first.GetProperty("pageSize").GetInt32().Should().Be(2);
        first.GetProperty("totalCount").GetInt32().Should().Be(5);
        first.GetProperty("totalPages").GetInt32().Should().Be(3);
        thirdCodes.Should().Equal(codes[4]);
        third.GetProperty("page").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task Ordena_por_codigo_o_nombre_en_ambos_sentidos()
    {
        RequireApi();
        var codes = await SeedAsync();

        var (_, byCodeDesc) = await ListAsync($"?search=L{Unique}&sortBy=code&sortOrder=desc");
        var (_, byNameAsc) = await ListAsync($"?search=L{Unique}&sortBy=name&sortOrder=asc");
        var (_, byCreatedDesc) = await ListAsync($"?search=L{Unique}&sortBy=createdAt&sortOrder=desc");

        byCodeDesc.Should().Equal(codes.Reverse());
        byNameAsc.Should().Equal(codes, "el nombre lleva el código, así que el orden coincide");
        byCreatedDesc.Should().BeEquivalentTo(codes);
    }

    [Fact]
    public async Task Filtra_por_estado_y_la_busqueda_no_distingue_mayusculas()
    {
        RequireApi();
        var codes = await SeedAsync();
        var suspended = new Org(
            (await FindIdAsync(codes[1])), codes[1], await VersionByCodeAsync(codes[1]));
        await ActAsync(suspended, new Step(HttpMethod.Post, "/suspend"));

        var (_, onlySuspended) = await ListAsync($"?search=L{Unique}&status=Suspended");
        var (_, onlyActive) = await ListAsync($"?search=l{Unique.ToLowerInvariant()}&status=active");
        var (_, archived) = await ListAsync($"?search=L{Unique}&status=Archived");

        onlySuspended.Should().Equal(codes[1]);
        onlyActive.Should().Equal(codes[0], codes[2], codes[3], codes[4]);
        archived.Should().BeEmpty();
    }

    [Theory]
    [InlineData("?page=0")]
    [InlineData("?page=abc")]
    [InlineData("?pageSize=0")]
    [InlineData("?pageSize=101")]
    [InlineData("?sortBy=otro")]
    [InlineData("?sortOrder=sideways")]
    [InlineData("?status=Desconocido")]
    public async Task Parametros_fuera_de_rango_responden_400_con_code(string query)
    {
        RequireApi();

        using var response = await SendAsync(new Call(HttpMethod.Get, TenantsUrl + query));

        await ShouldBeProblemAsync(response, HttpStatusCode.BadRequest, "validation.failed");
    }

    private async Task<Guid> FindIdAsync(string code)
    {
        using var response = await SendAsync(new Call(HttpMethod.Get, $"{TenantsUrl}?search={code}"));
        return (await JsonOf(response)).GetProperty("items")[0].GetProperty("id").GetGuid();
    }

    private async Task<long> VersionByCodeAsync(string code)
    {
        using var response = await SendAsync(new Call(HttpMethod.Get, $"{TenantsUrl}?search={code}"));
        return (await JsonOf(response)).GetProperty("items")[0].GetProperty("version").GetInt64();
    }
}
