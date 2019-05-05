/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as request from 'request';

import { CatalogEntry, Collection, Domain, Problem } from './CatalogEntry';

export class PlanningDomains {

    public static readonly URL = "https://api.planning.domains/json/classical/";
    static readonly SESSION_URL = "http://localhost:5000/";

    private parseCollection(collection_json: any): Collection {
        return new Collection(
            collection_json["collection_id"],
            collection_json["collection_name"],
            collection_json["description"],
            JSON.parse(collection_json["domain_set"])
        );
    }

    async getCollections(): Promise<CatalogEntry[]> {
        let url = PlanningDomains.URL + "collections";
        let json_output = await this.get(url);
        return json_output
            .map((collection_json: any) => this.parseCollection(collection_json));
    }

    private parseDomain(domain_json: any): Domain {
        return new Domain(
            domain_json["domain_id"],
            domain_json["domain_name"],
            domain_json["description"]
        );
    }

    async getDomains(collection: Collection): Promise<CatalogEntry[]> {
        let url = PlanningDomains.URL + "domains/" + collection.id;
        let json_output = await this.get(url);
        return json_output
            .map((domain_json: any) => this.parseDomain(domain_json))
            .sort(compareCatalogEntry);
    }

    private parseProblem(problem_json: any): Problem {
        return new Problem(
            problem_json["problem_id"],
            problem_json["problem"],
            problem_json["domain_url"],
            problem_json["problem_url"]
        );
    }

    async getProblems(domain: Domain): Promise<CatalogEntry[]> {
        let url = PlanningDomains.URL + "problems/" + domain.id;
        let json_output = await this.get(url);
        return json_output
            .map((problem_json: any) => this.parseProblem(problem_json))
            .sort(compareCatalogEntry);
    }

    async getSession(sessionId: string): Promise<any> {
        let url = `${PlanningDomains.SESSION_URL}session/${sessionId}`;
        let json_output = await this.get(url);
        return json_output;
    }

    createSessionFileUrl(sessionId: string, fileName: string): string {
        return `${PlanningDomains.SESSION_URL}session/${sessionId}/${fileName}`;
    }

    async getSessionFile(sessionId: string, fileName: string): Promise<string> {
        let url = this.createSessionFileUrl(sessionId, fileName);
        return this.getText(url);
    }

    async putSessionFile(sessionId: string, fileName: string, content: string): Promise<string> {
        let url = this.createSessionFileUrl(sessionId, fileName);
        return new Promise<string>((resolve, reject) => {
            request.put(url, { body: content }, (error: any, httpResponse: request.Response, body: any) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (httpResponse && httpResponse.statusCode > 204) {
                        reject("HTTP status code " + httpResponse.statusCode);
                    }
                    else {
                        resolve(body);
                    }
                }
            });
        });
    }

    async postSessionFile(sessionId: string, fileName: string, content: string): Promise<string> {
        let url = this.createSessionFileUrl(sessionId, fileName);
        return new Promise<string>((resolve, reject) => {
            request.post(url, { body: content }, (error: any, httpResponse: request.Response, body: any) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (httpResponse && httpResponse.statusCode > 204) {
                        reject("HTTP status code " + httpResponse.statusCode);
                    }
                    else {
                        resolve(body);
                    }
                }
            });
        });
    }

    async deleteSessionFile(sessionId: string, fileName: string): Promise<void> {
        let url = this.createSessionFileUrl(sessionId, fileName);
        return new Promise<void>((resolve, reject) => {
            request.delete(url, (error: any, httpResponse: request.Response) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (httpResponse && httpResponse.statusCode > 204) {
                        reject("HTTP status code " + httpResponse.statusCode);
                    }
                    else {
                        resolve();
                    }
                }
            });
        });
    }

    private getText(url: string): string | PromiseLike<string> {
        return new Promise<string>((resolve, reject) => {
            request.get(url, (error: any, httpResponse: request.Response, body: any) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (httpResponse && httpResponse.statusCode != 200) {
                        reject("HTTP status code " + httpResponse.statusCode);
                    }
                    else {
                        resolve(body);
                    }
                }
            });
        });
    }

    get(url: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            request.get(url, { json: true }, (error: any, httpResponse: request.Response, body: any) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (httpResponse && httpResponse.statusCode != 200) {
                        reject("HTTP status code " + httpResponse.statusCode);
                    }
                    else {
                        resolve(body["result"]);
                    }
                }
            });
        });
    }
}

function compareCatalogEntry(a: CatalogEntry, b: CatalogEntry) {
    if (a.label < b.label)
        return -1;
    if (a.label > b.label)
        return 1;
    return 0;
}
