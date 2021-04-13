import * as cdk from "@aws-cdk/core";
import * as appsync from "@aws-cdk/aws-appsync";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export class CdkappsyncDynamoGsiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const PREFIX_NAME = id.toLowerCase().replace("stack", "")
    const GSI_NAME = PREFIX_NAME + "-gsi"

    const api = new appsync.GraphqlApi(this, "Api", {
      name: PREFIX_NAME + "-api",
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
      schema: new appsync.Schema({
        filePath: "graphql/schema.graphql",
      }),
    })

    const table = new dynamodb.Table(this, "table", {
      tableName: PREFIX_NAME + "-table",
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    table.addGlobalSecondaryIndex({
      indexName: GSI_NAME,
      partitionKey: {
        name: "title",
        type: dynamodb.AttributeType.STRING,
      },
    })

    const datasource = api.addDynamoDbDataSource(
      "datasource",
      table
    )

    datasource.createResolver({
      typeName: "Query",
      fieldName: "listItems",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    })

    datasource.createResolver({
      typeName: "Query",
      fieldName: "getItemByTitle",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
        appsync.KeyCondition.eq("title", "title"),
        GSI_NAME
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    })

    datasource.createResolver({
      typeName: "Mutation",
      fieldName: "addItem",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition("id").auto(),
        appsync.Values.projecting("input")
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    })
  }
}
