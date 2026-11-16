using System.Net;
using FluentAssertions;
using Mdm.Presentation.IntegrationTest.Support;

namespace Mdm.Presentation.IntegrationTest.EndToEnd;

/// <summary>ETag, If-Match, If-None-Match y concurrencia optimista contra SQL Server real (contrato §1.1).</summary>
[Collection(MdmApiCollection.Name)]
public sealed class PreconditionsE2ETest(MdmApiFixture fixture) : EndToEndTestBase(fixture)
{
    private static readonly object Update = new { name = "Nombre nuevo", organizationType = "SUPPLIER", companyReference = (string?)null };

    [Fact]
    public async Task Alta_responde_201_con_location_y_etag_y_el_recurso_se_lee()
    {
        RequireApi();
        var code = NewCode();

        using var created = await SendAsync(new Call(HttpMethod.Post, TenantsUrl)
        {
            Body = new { code = code.ToLowerInvariant(), name = "Org", organizationType = "CLIENT" },
        });

        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await JsonOf(created);
        var id = body.GetProperty("id").GetGuid();
        created.Headers.Location!.ToString().Should().EndWith($"{TenantsUrl}/{id}");
        VersionOf(created).Should().Be(body.GetProperty("version").GetInt64());

        using var read = await SendAsync(new Call(HttpMethod.Get, $"{TenantsUrl}/{id}"));
        read.StatusCode.Should().Be(HttpStatusCode.OK);
        VersionOf(read).Should().Be(VersionOf(created));
        var tenant = await JsonOf(read);
        tenant.GetProperty("code").GetString().Should().Be(code, "el código se normaliza a mayúsculas");
        tenant.GetProperty("status").GetString().Should().Be("Active");
        tenant.GetProperty("createdBy").GetString().Should().Be("usuario-de-prueba");
    }

    [Fact]
    public async Task Get_con_if_none_match_vigente_responde_304_y_con_otro_200()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        using var notModified = await SendAsync(new Call(HttpMethod.Get, org.Url) { IfNoneMatch = Quote(org.Version) });
        using var changed = await SendAsync(new Call(HttpMethod.Get, org.Url) { IfNoneMatch = Quote(org.Version + 99) });

        notModified.StatusCode.Should().Be(HttpStatusCode.NotModified);
        (await notModified.Content.ReadAsStringAsync(Ct)).Should().BeEmpty();
        changed.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Put_correcto_responde_204_con_etag_nuevo_y_con_el_viejo_412()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var stale = org.Version;

        using var ok = await WriteAsync(org, new Step(HttpMethod.Put, string.Empty, Update));
        using var conflict = await SendAsync(new Call(HttpMethod.Put, org.Url) { Body = Update, IfMatch = Quote(stale) });

        ok.StatusCode.Should().Be(HttpStatusCode.NoContent);
        org.Version.Should().BeGreaterThan(stale);
        await ShouldBeProblemAsync(conflict, HttpStatusCode.PreconditionFailed, "precondition.failed");
    }

    [Fact]
    public async Task Put_sin_if_match_o_con_comodin_responde_428()
    {
        RequireApi();
        var org = await CreateTenantAsync();

        using var missing = await SendAsync(new Call(HttpMethod.Put, org.Url) { Body = Update });
        using var wildcard = await SendAsync(new Call(HttpMethod.Put, org.Url) { Body = Update, IfMatch = "*" });

        await ShouldBeProblemAsync(missing, HttpStatusCode.PreconditionRequired, "precondition.required");
        await ShouldBeProblemAsync(wildcard, HttpStatusCode.PreconditionRequired, "precondition.required");
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("1")]
    [InlineData("W/\"1\"")]
    [InlineData("\"1\", \"2\"")]
    public async Task Put_con_if_match_mal_formado_responde_400(string ifMatch)
    {
        RequireApi();
        var org = await CreateTenantAsync();

        using var response = await SendAsync(new Call(HttpMethod.Put, org.Url) { Body = Update, IfMatch = ifMatch });

        await ShouldBeProblemAsync(response, HttpStatusCode.BadRequest, "validation.failed");
    }

    [Fact]
    public async Task Dos_put_simultaneos_con_el_mismo_if_match_dejan_uno_2xx_y_otro_412()
    {
        RequireApi();
        for (var round = 0; round < 5; round++)
        {
            var org = await CreateTenantAsync(NewCode("R" + round));
            var ifMatch = Quote(org.Version);

            var calls = new[] { "Primero", "Segundo" }.Select(name =>
                SendAsync(new Call(HttpMethod.Put, org.Url)
                {
                    Body = new { name, organizationType = "CLIENT", companyReference = (string?)null },
                    IfMatch = ifMatch,
                })).ToArray();
            var responses = await Task.WhenAll(calls);

            try
            {
                responses.Count(r => r.IsSuccessStatusCode).Should().Be(1, "round {0}", round);
                var loser = responses.Single(r => !r.IsSuccessStatusCode);
                await ShouldBeProblemAsync(loser, HttpStatusCode.PreconditionFailed, "precondition.failed");
            }
            finally
            {
                foreach (var response in responses)
                {
                    response.Dispose();
                }
            }
        }
    }

    [Fact]
    public async Task Cada_escritura_sube_la_version_y_la_sede_comparte_la_del_tenant()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var v0 = org.Version;

        var branchId = await AddBranchAsync(org, "S1");
        var v1 = org.Version;
        using var branch = await SendAsync(new Call(HttpMethod.Get, $"{org.BranchesUrl}/{branchId}"));
        using var tenant = await SendAsync(new Call(HttpMethod.Get, org.Url));
        using var list = await SendAsync(new Call(HttpMethod.Get, org.BranchesUrl));
        await ActAsync(org, new Step(HttpMethod.Put, $"/branches/{branchId}", new { name = "Renombrada" }));

        v1.Should().BeGreaterThan(v0, "añadir una sede muta el agregado del tenant");
        VersionOf(branch).Should().Be(v1, "el ETag de la sede es la versión de su tenant");
        VersionOf(tenant).Should().Be(v1);
        VersionOf(list).Should().Be(v1);
        org.Version.Should().BeGreaterThan(v1);
    }

    [Fact]
    public async Task Escribir_una_sede_con_el_etag_anterior_a_otra_sede_responde_412()
    {
        RequireApi();
        var org = await CreateTenantAsync();
        var first = await AddBranchAsync(org, "S1");
        var second = await AddBranchAsync(org, "S2");
        var staleForSecond = org.Version;
        await ActAsync(org, new Step(HttpMethod.Put, $"/branches/{first}", new { name = "Cambia la primera" }));

        using var response = await SendAsync(new Call(HttpMethod.Put, $"{org.BranchesUrl}/{second}")
        {
            Body = new { name = "Con ETag viejo" },
            IfMatch = Quote(staleForSecond),
        });

        await ShouldBeProblemAsync(response, HttpStatusCode.PreconditionFailed, "precondition.failed");
    }
}
